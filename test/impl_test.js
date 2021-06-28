const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC998-ERC1155 Topdown implementation tests", () => {	
	before(async () => {
		let signers = await ethers.getSigners();

		this.DEPLOYER = signers[0];
		this.COMPOSABLE_OWNER = signers[1];
		this.MULTITOKENS_OWNER = signers[2];
		this.DEFAULT_EOA = signers[3];
	});

	beforeEach(async () => {
		const Composable = await ethers.getContractFactory("ERC998ERC1155TD");
		const MultiTokens = await ethers.getContractFactory("testERC1155");

		this.composable = await Composable.deploy(
			"Composable Token",
			"CTKN",
			"https://basetokenuri.com/"
		);

		this.multitokens = await MultiTokens.deploy();

		await this.composable.mint(this.COMPOSABLE_OWNER.address, 1);
		await this.multitokens.mint(this.MULTITOKENS_OWNER.address, 1);
	});


	describe("Deployments", () => {
		it ("Multitokens contract is deployed on local chain", async () => {
			expect(await this.multitokens.deployed()).to.be.ok;
		});
	
		it ("Composable token contract is deployed on local chain", async () => {
			expect(await this.composable.deployed()).to.be.ok;
		});  
    });


	describe("Constructor parameters integrity", () => {
		it ("Composable constructor parameters are correctly set", async () => {
			const name = await this.composable.name();
			const symb = await this.composable.symbol();
			const baseURI = await this.composable.baseURI();
			
			expect(name).to.equal("Composable Token");
			expect(symb).to.equal("CTKN");
			expect(baseURI).to.equal("https://basetokenuri.com/");
		});  
    });


	describe("Minting", () => {
		it ("A composable token has been correctly minted to COMPOSABLE_OWNER address", async () => {
			const tokenOwner = await this.composable.ownerOf(1);
			const ownerBalance = await this.composable.balanceOf(this.COMPOSABLE_OWNER.address);
	
			expect(tokenOwner).to.equal(this.COMPOSABLE_OWNER.address);
			expect(parseInt(ownerBalance)).to.equal(1)
		});
    });


	describe("Attaching a child ERC1155 token to a parent composable token", () => {      
		it("The transfer must revert if the receiving parent token ID from _data argument is unknown", async () => {
            const encodedNonExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['2']);

            await expect(
                this.multitokens
					.connect(this.MULTITOKENS_OWNER)
					.safeTransferFrom(
						this.MULTITOKENS_OWNER.address, 
						this.composable.address, 
						1, 
						1,
						encodedNonExistentParentID
					)
            )
			.to
			.be
			.revertedWith('ERC998ERC1155TD: Attaching to a nonexistent parent token');
        });
		
		
		it ("Child ERC1155 token has been correctly transfered from EOA to the parent composable", async () => {
            const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['1']);

            await this.multitokens
				.connect(this.MULTITOKENS_OWNER)
				.safeTransferFrom(
					this.MULTITOKENS_OWNER.address,
					this.composable.address, 
					1, 
					1, 
					encodedExistentParentID
				);
            
            const composableChildBalance = await this.composable.getChildBalanceOf(1, this.multitokens.address, 1);
                
            expect(parseInt(composableChildBalance)).to.equal(1);
        });


		it ("ChildReceived event has been emited with the correct arguments", async () => {
            const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['1']);
            
            await expect(
				this.multitokens
					.connect(this.MULTITOKENS_OWNER)
					.safeTransferFrom(
						this.MULTITOKENS_OWNER.address,
						this.composable.address, 
						1, 
						1, 
						encodedExistentParentID
            		)
			)
			.to
			.emit(this.composable, 'ChildReceived')
			.withArgs(this.MULTITOKENS_OWNER.address, 1, this.multitokens.address, 1, 1);
        });
    });


	describe("Detaching a child token from a parent composable token", () => {
        it ("The transfer must revert if the parent token ID is unknown", async () => {
            const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(['uint256'], ['0']);

			await expect(
				this.composable
					.connect(this.COMPOSABLE_OWNER)
					.safeTransferChildFrom(
						2, 
						this.DEFAULT_EOA.address, 
						this.multitokens.address, 
						1,
						1,
						dummyEncodedData
					)
			)
			.to
			.be
			.revertedWith('ERC998ERC1155TD: Transfering from a nonexistent parent token');
        });


        it ("The transfer must revert if the child token is not attached to the parent token", async () => {
			const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(['uint256'], ['0']);

			await expect(
				this.composable
					.connect(this.COMPOSABLE_OWNER)
					.safeTransferChildFrom(
						1, 
						this.DEFAULT_EOA.address, 
						this.multitokens.address, 
						1,
						1,
						dummyEncodedData
					)
			)
			.to
			.be
			.revertedWith('ERC998ERC1155TD: The child token is not attached to the parent token');
        });

        it ("The transfer must revert if msg.sender is not the parent token owner nor approved to transfer the child token", async () => {
			const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(['uint256'], ['0']);
			const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['1']);

			await this.multitokens
				.connect(this.MULTITOKENS_OWNER)
				.safeTransferFrom(
					this.MULTITOKENS_OWNER.address,
					this.composable.address, 
					1, 
					1, 
					encodedExistentParentID
				);

			await expect(
				this.composable
					.connect(this.DEFAULT_EOA)
					.safeTransferChildFrom(
						1, 
						this.DEFAULT_EOA.address, 
						this.multitokens.address, 
						1,
						1,
						dummyEncodedData
					)
			)
			.to
			.be
			.revertedWith('ERC998ERC1155TD: msg.sender is not the parent token owner nor approved to transfer the child token');
        });

        it ("The transfer must revert if child token balance is below requested transfer amount", async () => {
			const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(['uint256'], ['0']);
			const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['1']);

			await this.multitokens
				.connect(this.MULTITOKENS_OWNER)
				.safeTransferFrom(
					this.MULTITOKENS_OWNER.address,
					this.composable.address, 
					1, 
					1, 
					encodedExistentParentID
				);

			await expect(
				this.composable
					.connect(this.COMPOSABLE_OWNER)
					.safeTransferChildFrom(
						1, 
						this.DEFAULT_EOA.address,
						this.multitokens.address, 
						1,
						2,
						dummyEncodedData
					)
			)
			.to
			.be
			.revertedWith('ERC998ERC1155TD: Child token balance is below requested transfer amount or zero');
        });

		it ("The transfer must revert if requested child token amount to transfer is zero", async () => {
			const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(['uint256'], ['0']);
			const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['1']);

			await this.multitokens
				.connect(this.MULTITOKENS_OWNER)
				.safeTransferFrom(
					this.MULTITOKENS_OWNER.address,
					this.composable.address, 
					1, 
					1, 
					encodedExistentParentID
				)
			;

			await expect(
				this.composable
					.connect(this.COMPOSABLE_OWNER)
					.safeTransferChildFrom(
						1, 
						this.DEFAULT_EOA.address,
						this.multitokens.address, 
						1,
						0,
						dummyEncodedData
					)
			)
			.to
			.be
			.revertedWith('ERC998ERC1155TD: Child token balance is below requested transfer amount or zero');
        });

        it ("Child token has been correctly detached from the parent composable token and sent to the EOA", async () => {
			const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(['uint256'], ['0']);
			const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(['uint256'], ['1']);
			const beforeTransferEOAMultitokenBalance = await this.multitokens.balanceOf(this.DEFAULT_EOA.address, 1);
			
			let beforeTransferComposableChildBalance;
			let afterTransferEOAMultitokenBalance;
			let afterTransferComposableChildBalance;
			
			await this.multitokens
				.connect(this.MULTITOKENS_OWNER)
				.safeTransferFrom(
					this.MULTITOKENS_OWNER.address,
					this.composable.address, 
					1, 
					1, 
					encodedExistentParentID
				)
			;
			
			beforeTransferComposableChildBalance = await this.composable.getChildBalanceOf(1, this.multitokens.address, 1);

			await this.composable
				.connect(this.COMPOSABLE_OWNER)
				.safeTransferChildFrom(
					1, 
					this.DEFAULT_EOA.address,
					this.multitokens.address, 
					1,
					1,
					dummyEncodedData
				)

			afterTransferEOAMultitokenBalance = await this.multitokens.balanceOf(this.DEFAULT_EOA.address, 1);
			afterTransferComposableChildBalance = await this.composable.getChildBalanceOf(1, this.multitokens.address, 1);
			
			expect(afterTransferEOAMultitokenBalance).to.equal(beforeTransferEOAMultitokenBalance + 1);
			expect(afterTransferComposableChildBalance).to.equal(beforeTransferComposableChildBalance - 1);
		});
	});

});    