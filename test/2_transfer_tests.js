const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC998-ERC1155 Topdown single asset transfer tests", () => {
  before(async () => {
    let signers = await ethers.getSigners();

    this.DEPLOYER = signers[0];
    this.COMPOSABLE_OWNER = signers[1];
    this.MULTITOKENS_OWNER = signers[2];
    this.DEFAULT_EOA = signers[3];
  });

  beforeEach(async () => {
    const Composable = await ethers.getContractFactory("ExampleComposableToken");
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

  describe("Attaching a single child ERC1155 token to a parent composable token", () => {
    const encodedNonExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["2"]
    );
    const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["1"]
    );
    const childTokenIDToTransfer = 1;
    const childTokenAmountToTransfer = 1;

    it("The transfer must revert if the _data argument containing the recipient parent ID is not encoded as uint256", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            childTokenIDToTransfer,
            childTokenIDToTransfer,
            1
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Data argument must contain the receiving parent token ID as uint256"
      );
    });

    it("The transfer must revert if the receiving parent token ID from _data argument is unknown", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            childTokenIDToTransfer,
            childTokenIDToTransfer,
            encodedNonExistentParentID
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Attaching to a nonexistent parent token"
      );
    });

    it("The child ERC1155 token has been correctly transfered from EOA to the parent composable", async () => {
      const composableChildBalance =
        await this.composable.getChildBalanceOfParent(
          1,
          this.multitokens.address,
          1
        );
      let updatedComposableChildBalance;
      let composableChildrenContracts;
      let composableChildrenIDs;

      await this.multitokens
        .connect(this.MULTITOKENS_OWNER)
        .safeTransferFrom(
          this.MULTITOKENS_OWNER.address,
          this.composable.address,
          childTokenIDToTransfer,
          childTokenAmountToTransfer,
          encodedExistentParentID
        );

      updatedComposableChildBalance =
        await this.composable.getChildBalanceOfParent(
          1,
          this.multitokens.address,
          childTokenAmountToTransfer
        );
      composableChildrenContracts =
        await this.composable.getChildrenContractsOfParent(1);
      composableChildrenIDs =
        await this.composable.getChildrenIDsOfParentForChildContract(
          1,
          this.multitokens.address
        );

      expect(composableChildrenContracts)
        .to.be.an("array")
        .that.includes(this.multitokens.address);
      expect(composableChildrenIDs).to.be.an("array");
      expect(composableChildrenIDs[0].toNumber()).to.equal(
        childTokenIDToTransfer
      );
      expect(updatedComposableChildBalance).to.equal(
        composableChildBalance + childTokenAmountToTransfer
      );
    });

    it("ChildReceived event has been emited with the correct arguments", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            childTokenIDToTransfer,
            childTokenAmountToTransfer,
            encodedExistentParentID
          )
      )
        .to.emit(this.composable, "ChildReceived")
        .withArgs(
          this.MULTITOKENS_OWNER.address,
          1,
          this.multitokens.address,
          childTokenIDToTransfer,
          childTokenAmountToTransfer
        );
    });
  });

  describe("Detaching a single child ERC1155 token from a parent composable token", () => {
    const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["1"]
    );
    const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["0"]
    );
    const childTokenIDToTransfer = 1;
    const childTokenAmountToTransfer = 1;

    beforeEach(async () => {
      await this.multitokens
        .connect(this.MULTITOKENS_OWNER)
        .safeTransferFrom(
          this.MULTITOKENS_OWNER.address,
          this.composable.address,
          childTokenIDToTransfer,
          childTokenAmountToTransfer,
          encodedExistentParentID
        );
    });

    it("The transfer must revert if the parent token ID is unknown", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildFrom(
            2,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childTokenIDToTransfer,
            childTokenAmountToTransfer,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Transfering from a nonexistent parent token"
      );
    });

    it("The transfer must revert if the child token is not attached to the parent token", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            2,
            childTokenAmountToTransfer,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: The child token is not attached to the parent token"
      );
    });

    it("The transfer must revert if msg.sender is not the parent token owner nor approved to transfer the child token", async () => {
      await expect(
        this.composable
          .connect(this.DEFAULT_EOA)
          .safeTransferChildFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childTokenIDToTransfer,
            childTokenAmountToTransfer,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: msg.sender is not the parent token owner nor approved to transfer the child token"
      );
    });

    it("The transfer must revert if child token balance is below requested transfer amount", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childTokenIDToTransfer,
            2,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Child token balance is below requested transfer amount or zero"
      );
    });

    it("The transfer must revert if requested child token amount to transfer is zero", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childTokenIDToTransfer,
            0,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Child token balance is below requested transfer amount or zero"
      );
    });

    it("The child ERC1155 token has been correctly detached from the parent composable token and sent to the EOA", async () => {
      const beforeTransferEOAMultitokenBalance =
        await this.multitokens.balanceOf(this.DEFAULT_EOA.address, 1);
      const beforeTransferComposableChildBalance =
        await this.composable.getChildBalanceOfParent(
          1,
          this.multitokens.address,
          1
        );
      let afterTransferEOAMultitokenBalance;
      let afterTransferComposableChildBalance;

      await this.composable
        .connect(this.COMPOSABLE_OWNER)
        .safeTransferChildFrom(
          1,
          this.DEFAULT_EOA.address,
          this.multitokens.address,
          childTokenIDToTransfer,
          childTokenAmountToTransfer,
          dummyEncodedData
        );

      afterTransferEOAMultitokenBalance = await this.multitokens.balanceOf(
        this.DEFAULT_EOA.address,
        1
      );
      afterTransferComposableChildBalance =
        await this.composable.getChildBalanceOfParent(
          1,
          this.multitokens.address,
          1
        );

      expect(afterTransferEOAMultitokenBalance).to.equal(
        beforeTransferEOAMultitokenBalance + 1
      );
      expect(afterTransferComposableChildBalance).to.equal(
        beforeTransferComposableChildBalance - 1
      );
    });
  });
});
