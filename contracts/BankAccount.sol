// SPDX-License-Identifier: MIT
pragma solidity >= 0.7.0 < 0.9.0;

contract BankAccount {
    event Deposit(address indexed user, uint indexed accountId, uint value, uint timestamp);
    event WithdrawRequested(address indexed user, uint indexed accountId, uint indexed withdrawId, uint amount, uint timestamp);
    event Withdraw(uint indexed withdrawId, uint timestamp);
    event AccountCreated(address[] owners, uint indexed id, uint timestamp);

    struct WithdrawRequest {
        address user;
        uint amount;
        uint approvals;
        mapping(address => bool) ownersApproved;
        bool approved;
    }

    struct Account {
        address[] owners;
        uint balance;
        mapping(uint => WithdrawRequest) withdrawRequests;
    }

    mapping(uint => Account) accounts;
    mapping(address => uint[]) userAccounts;

    uint nextAccountId;
    uint nextWithdrawId;

    modifier accountOwner(uint accountId){
        //check that user is an account owner before letting them deposit money
        bool isOwner;
        for(uint idx; idx < accounts[accountId].owners.length; idx++){
            if(accounts[accountId].owners[idx] == msg.sender){
                isOwner = true;
                break;
            }
        }
        require(isOwner, "You are not an owner of this account");
        _;
    }

    function deposit(uint accountId) external payable accountOwner(accountId) {
        accounts[accountId].balance += msg.value;
    }

    modifier validOwners(address[] calldata owners) {
        require(owners.length + 1 <= 4, "Maximum of 4 owners per account");
        for (uint i; i < owners.length; i++) {
            if(owners[i] == msg.sender){
                revert("No duplicate Owners");
            }
            for (uint256 j = i + 1; j < owners.length; j++) {
                if(owners[i] == owners[j]){
                    revert("No duplicate owners");
                }
            }
        }
        _;
    }

    function createAccount(address[] calldata otherOwners) external validOwners(otherOwners) {
        address[] memory owners = new address[](otherOwners.length + 1);
        owners[otherOwners.length] = msg.sender;

        uint id = nextAccountId;

        for(uint idx; idx < owners.length; idx++){
            if(idx < owners.length - 1){
                owners[idx] = otherOwners[idx];
            }

            if(userAccounts[owners[idx]].length > 2){
                revert("each user can have a max of 3 accounts");
            }
            userAccounts[owners[idx]].push(id);
        }

        accounts[id].owners = owners;
        nextAccountId++;
        emit AccountCreated(owners, id, block.timestamp);
    }

    modifier sufficientBalance(uint accountId, uint amount){
        require(accounts[accountId].balance >= amount, "Insufficient Balance");
        _;
    }

    function requestWithdrawal(uint accountId, uint amount) external accountOwner(accountId) sufficientBalance(accountId, amount) {
        uint id = nextWithdrawId;
        WithdrawRequest storage request = accounts[accountId].withdrawRequests[id];
        request.user = msg.sender;
        request.amount = amount;
        nextWithdrawId++;
        emit WithdrawRequested(msg.sender, accountId, id, amount, block.timestamp);
    }

    modifier canApprove(uint accountId, uint withdrawalId){
        require(!accounts[accountId].withdrawRequests[withdrawalId].approved, "Request is already approved");
        require(accounts[accountId].withdrawRequests[withdrawalId].user != msg.sender, "Cannout approve this request");
        require(accounts[accountId].withdrawRequests[withdrawalId].user != address(0), "This request does not exist");
        require(!accounts[accountId].withdrawRequests[withdrawalId].ownersApproved[msg.sender], "You have already approved this request");
        _;
    }

    function approveWithdrawal(uint accountId, uint withdrawalId) external accountOwner(accountId) canApprove(accountId, withdrawalId) {
        WithdrawRequest storage request = accounts[accountId].withdrawRequests[withdrawalId];
        request.approvals++;
        request.ownersApproved[msg.sender] = true;
        
        if(request.approvals == accounts[accountId].owners.length - 1){
            request.approved = true;
        }
    }

    modifier canWithdraw(uint accountId, uint withdrawId){
        require(accounts[accountId].withdrawRequests[withdrawId].user == msg.sender, "You did not create this require");
        require(accounts[accountId].withdrawRequests[withdrawId].approved, "Request is not approved");
        _;
    }

    function withdraw(uint accountId, uint withdrawId) external canWithdraw(accountId, withdrawId) {
        uint amount = accounts[accountId].withdrawRequests[withdrawId].amount;
        require(accounts[accountId].balance >= amount, "Insufficient Balance");

        accounts[accountId].balance -= amount;
        delete accounts[accountId].withdrawRequests[withdrawId];

        (bool sent,) = payable(msg.sender).call{ value: amount}("");
        require(sent);
        emit Withdraw(withdrawId, block.timestamp);
    }

    function getBalance(uint accountId) public view returns (uint) {
        return accounts[accountId].balance;
    }

    function getOwners(uint accountId) public view returns (address[] memory){
        return accounts[accountId].owners;
    }

    function getApprovals(uint accountId, uint withdrawId) public view returns(uint){
        return accounts[accountId].withdrawRequests[withdrawId].approvals;
    }

    function getAccounts() public view returns(uint[] memory){
        return userAccounts[msg.sender];
    }
}
