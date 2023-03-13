const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
  
describe("Bank Account", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployBankAccount() {// Contracts are deployed using the first signer/account by default
        const [addr0, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        const BankAccount = await ethers.getContractFactory("BankAccount");
        const bankAccount = await BankAccount.deploy();

        return { bankAccount, addr0, addr1, addr2, addr3, addr4 };
    }

    async function deployBankAccountWithAccounts(owners=1, deposit=0, withdrawalAmounts=[]) {// Contracts are deployed using the first signer/account by default
        const {bankAccount, addr0, addr1, addr2, addr3, addr4} = await loadFixture(deployBankAccount)
        let addresses = []
        if(owners == 2){
            addresses = [addr1.address]
        }
        else if(owners == 3){
            addresses = [addr1.address, addr2.address]
        }
        else if(owners == 4){
            addresses = [addr1.address, addr2.address, addr3.address]
        }
        await bankAccount.connect(addr0).createAccount(addresses)
        if(deposit > 0){
            await bankAccount.connect(addr0).deposit(0, { value: deposit.toString() })
        }

        for(const withdrawalAmount of withdrawalAmounts){
            await bankAccount.connect(addr0).requestWithdrawal(0, withdrawalAmount);
        }

        return { bankAccount, addr0, addr1, addr2, addr3, addr4 }
    }

    describe("Deployment", () => {
        it("should deploy without error", async() => {
            await loadFixture(deployBankAccount)
        })
    })

    describe("Creating an account", () => {
        it("should allow creating a single user account", async() => {
            const { bankAccount, addr0 } = await loadFixture(deployBankAccount)
            await bankAccount.connect(addr0).createAccount([])
            const account = await bankAccount.connect(addr0).getAccounts();
            expect(account.length).to.equal(1);
        })

        it("should allow creating a double user account", async() => {
            const { bankAccount, addr0, addr1 } = await loadFixture(deployBankAccount)
            await bankAccount.connect(addr0).createAccount([addr1.address])
            const account1 = await bankAccount.connect(addr0).getAccounts();
            const account2 = await bankAccount.connect(addr1).getAccounts();
            expect(account1.length).to.equal(1);
            expect(account2.length).to.equal(1);
        })

        it("should allow creating a triple user account", async() => {
            const { bankAccount, addr0, addr1, addr2 } = await loadFixture(deployBankAccount)
            await bankAccount.connect(addr0).createAccount([addr1.address, addr2.address])
            const account1 = await bankAccount.connect(addr0).getAccounts();
            const account2 = await bankAccount.connect(addr1).getAccounts();
            const account3 = await bankAccount.connect(addr2).getAccounts();
            expect(account1.length).to.equal(1);
            expect(account2.length).to.equal(1);
            expect(account3.length).to.equal(1);
        })

        it("should allow creating a triple user account", async() => {
            const { bankAccount, addr0, addr1, addr2, addr3 } = await loadFixture(deployBankAccount)
            await bankAccount.connect(addr0).createAccount([addr1.address, addr2.address, addr3.address])
            const account1 = await bankAccount.connect(addr0).getAccounts();
            const account2 = await bankAccount.connect(addr1).getAccounts();
            const account3 = await bankAccount.connect(addr2).getAccounts();
            const account4 = await bankAccount.connect(addr3).getAccounts();
            expect(account1.length).to.equal(1);
            expect(account2.length).to.equal(1);
            expect(account3.length).to.equal(1);
            expect(account4.length).to.equal(1);
        })

        it("should not allow creating an account with duplicate owners", async() => {
            const { bankAccount, addr0 } = await loadFixture(deployBankAccount)
            await expect(bankAccount.connect(addr0)
                .createAccount([addr0.address]))
                .to.be.reverted
        })

        it("should not allow creating an account with 5 owners", async() => {
            const { bankAccount, addr0, addr1, addr2, addr3, addr4 } = await loadFixture(deployBankAccount)
            await expect(bankAccount.connect(addr0)
                .createAccount([addr0.address, addr1.address, addr2.address, addr3.address, addr4.address])
            ).to.be.reverted
        })

        it("should not allow creating an account with 5 owners", async() => {
            const { bankAccount, addr0 } = await loadFixture(deployBankAccount)
            for (let index = 0; index < 3; index++) {
                await bankAccount.connect(addr0).createAccount([])
            }
            await expect(bankAccount.connect(addr0).createAccount([]))
                .to.be.reverted
        })
    })

    describe('Depositing', () => {
        it("should allow deposit from account owner", async() => {
            const { bankAccount, addr0 } = await deployBankAccountWithAccounts(1)
            await expect(bankAccount.connect(addr0).deposit(0, {value: "100"}))
                .to.changeEtherBalances([ bankAccount, addr0], ["100", "-100"])
        })

        it("should not allow deposit from account owner", async() => {
            const { bankAccount, addr1 } = await deployBankAccountWithAccounts(1)
            await expect(bankAccount.connect(addr1).deposit(0, {value: "100"}))
                .to.be.reverted
        })
    })

    describe("Withdraw", () => {
        describe("Request a withdrawal", () => {
            it("account owner can request withdraw", async () => {
                const { bankAccount, addr0 } = await deployBankAccountWithAccounts(1, 100)
                await bankAccount.connect(addr0).requestWithdrawal(0, 100)
            });
            it("account owner cannot request withdraw with invalid amount", async () => {
                const { bankAccount, addr0 } = await deployBankAccountWithAccounts(1, 100);
                await expect(bankAccount.connect(addr0).requestWithdrawal(0, 101)).to.be.reverted
            })
            it("none account owner cannot request withdraw", async () => {
                const { bankAccount, addr1 } = await deployBankAccountWithAccounts(1, 100)
                await expect(bankAccount.connect(addr1).requestWithdrawal(0, 90)).to.be.reverted
            })
            it("owner cann request multiple withdrawal", async () => {
                const { bankAccount, addr0 } = await deployBankAccountWithAccounts(1, 100)
                await bankAccount.connect(addr0).requestWithdrawal(0, 90)
                await bankAccount.connect(addr0).requestWithdrawal(0, 10)
            })
        })
        describe("Approve a withdrawal", () => {
            it('should allow account owner to approve withdrawal', async() => {
                const { bankAccount, addr1 } = await deployBankAccountWithAccounts(2, 100, [100])
                await bankAccount.connect(addr1).approveWithdrawal(0, 0)
                expect(await bankAccount.getApprovals(0,0)).to.equal(1)
            })
            it('should not allow non account owner to approve withdrawal', async() => {
                //we use addr2 because they are not account owners here addr0 and addr1 are
                const { bankAccount, addr2 } = await deployBankAccountWithAccounts(2, 100, [100])
                await expect(bankAccount.connect(addr2).approveWithdrawal(0, 0)).to.be.reverted;
            })
            it('should not allow account owner to approve withdrawal multiple times', async() => {
                const { bankAccount, addr1 } = await deployBankAccountWithAccounts(2, 100, [100])
                bankAccount.connect(addr1).approveWithdrawal(0, 0)
                await expect(bankAccount.connect(addr1).approveWithdrawal(0, 0)).to.be.reverted;
            })
            it('should not allow request creator to approve withdrawal', async() => {
                const { bankAccount, addr0 } = await deployBankAccountWithAccounts(2, 100, [100])
                await expect(bankAccount.connect(addr0).approveWithdrawal(0, 0)).to.be.reverted;
            })
        })
        describe("Make a withdrawal", () => {
            it('should allow request creator to withdraw approve request', async() => {
                const { bankAccount, addr0, addr1 } = await deployBankAccountWithAccounts(2, 100, [100])
                await bankAccount.connect(addr1).approveWithdrawal(0, 0)
                await expect(bankAccount.connect(addr0).withdraw(0,0)).to.changeEtherBalances([bankAccount, addr0], ["-100", "100"])
            })

            it('should allow request creator to withdraw approve request twice', async() => {
                const { bankAccount, addr0, addr1 } = await deployBankAccountWithAccounts(2, 200, [100])
                await bankAccount.connect(addr1).approveWithdrawal(0, 0)
                await expect(bankAccount.connect(addr0).withdraw(0,0)).to.changeEtherBalances([bankAccount, addr0], ["-100", "100"])
                await expect(bankAccount.connect(addr0).withdraw(0,0)).to.be.reverted
            })

            it('should not allow non request creator to withdraw approve request', async() => {
                const { bankAccount, addr1 } = await deployBankAccountWithAccounts(2, 200, [100])
                await bankAccount.connect(addr1).approveWithdrawal(0, 0)
                await expect(bankAccount.connect(addr1).withdraw(0,0)).to.be.reverted
            })

            it('should not allow non request creator to withdraw approve request', async() => {
                const { bankAccount, addr0 } = await deployBankAccountWithAccounts(2, 200, [100])
                await expect(bankAccount.connect(addr0).withdraw(0,0)).to.be.reverted
            })
        })
    })
})
  