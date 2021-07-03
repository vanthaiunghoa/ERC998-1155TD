const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC998-ERC1155 Topdown batch transfer tests", () => {
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

  describe("Attaching a batch of children ERC1155 tokens to a parent composable token", () => {
    const childrenIDsToTransfer = [2, 3, 4, 5];
    const childrenAmountsToTransfer = [1, 100, 10, 2];
    const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["0"]
    );
    const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["1"]
    );
    const encodedNonExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["2"]
    );

    beforeEach(async () => {
      await this.multitokens.mintBatch(
        this.MULTITOKENS_OWNER.address,
        childrenIDsToTransfer,
        childrenAmountsToTransfer,
        dummyEncodedData
      );
    });

    it("The transfer must revert if the _data argument containing the recipient parent ID is not encoded as uint256", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeBatchTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            childrenIDsToTransfer,
            childrenAmountsToTransfer,
            3
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Data argument must contain the receiving parent token ID as uint256"
      );
    });

    it("The transfer must revert if the receiving parent token ID from _data argument is unknown", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeBatchTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            childrenIDsToTransfer,
            childrenAmountsToTransfer,
            encodedNonExistentParentID
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Attaching to a nonexistent parent token"
      );
    });

    it("The transfer must revert if children tokenIDs and children tokenAmounts arrays size mismatch", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeBatchTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            [2, 3, 4, 5],
            [1, 100, 10, 2, 13],
            encodedExistentParentID
          )
      ).to.be.reverted;
    });

    it("The batch of ERC1155 tokens has been correctly transfered from EOA to the parent composable", async () => {
      let childrenContracts;
      let childrenIDs;

      await this.multitokens
        .connect(this.MULTITOKENS_OWNER)
        .safeBatchTransferFrom(
          this.MULTITOKENS_OWNER.address,
          this.composable.address,
          childrenIDsToTransfer,
          childrenAmountsToTransfer,
          encodedExistentParentID
        );

      childrenContracts = await this.composable.getChildrenContractsOfParent(1);
      childrenIDs =
        await this.composable.getChildrenIDsOfParentForChildContract(
          1,
          this.multitokens.address
        );

      expect(childrenContracts)
        .to.be.an("array")
        .that.includes(this.multitokens.address);

      for (let i = 0; i < childrenIDs.length; i++) {
        let childTokenID = i + 2; // Skiping tokenID#0 | tokenID#1 already minted in main beforeEach() hook
        let updatedChildBalance = await this.composable.getChildBalanceOfParent(
          1,
          this.multitokens.address,
          childTokenID
        );

        expect(childrenIDs[i].toNumber()).to.equal(childTokenID);
        expect(updatedChildBalance).to.equal(childrenAmountsToTransfer[i]);
      }
    });

    it("ChildrenReceived event has been emited with the correct arguments", async () => {
      await expect(
        this.multitokens
          .connect(this.MULTITOKENS_OWNER)
          .safeBatchTransferFrom(
            this.MULTITOKENS_OWNER.address,
            this.composable.address,
            childrenIDsToTransfer,
            childrenAmountsToTransfer,
            encodedExistentParentID
          )
      )
        .to.emit(this.composable, "ChildrenReceived")
        .withArgs(
          this.MULTITOKENS_OWNER.address,
          1,
          this.multitokens.address,
          childrenIDsToTransfer,
          childrenAmountsToTransfer
        );
    });
  });

  describe("Detaching a batch of children ERC1155 tokens from a parent composable token", () => {
    const childrenIDsToTransfer = [1, 2, 3, 4];
    const childrenAmountsToTransfer = [1, 100, 10, 2];
    const dummyEncodedData = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["0"]
    );
    const encodedExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["1"]
    );
    const encodedNonExistentParentID = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      ["2"]
    );

    beforeEach(async () => {
      await this.multitokens.mintBatch(
        this.MULTITOKENS_OWNER.address,
        childrenIDsToTransfer,
        childrenAmountsToTransfer,
        dummyEncodedData
      );

      await this.multitokens
        .connect(this.MULTITOKENS_OWNER)
        .safeBatchTransferFrom(
          this.MULTITOKENS_OWNER.address,
          this.composable.address,
          childrenIDsToTransfer,
          childrenAmountsToTransfer,
          encodedExistentParentID
        );
    });

    it("The transfer must revert if the parent token ID is unknown", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildrenFrom(
            2,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childrenIDsToTransfer,
            childrenAmountsToTransfer,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Transfering from a nonexistent parent token"
      );
    });

    it("The transfer must revert if msg.sender is not the parent token owner nor approved to transfer the children tokens", async () => {
      await expect(
        this.composable
          .connect(this.DEFAULT_EOA)
          .safeTransferChildrenFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childrenIDsToTransfer,
            childrenAmountsToTransfer,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: msg.sender is not the parent token owner nor approved to transfer the children tokens"
      );
    });

    it("The transfer must revert if children tokenIDs and children tokenAmounts arrays size mismatch", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildrenFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childrenIDsToTransfer,
            [1, 100, 10, 2, 10],
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: Child tokens amounts and IDs arrays size mismatch"
      );
    });

    it("The transfer must revert if one of the children tokenIDs is not attached to the parent", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildrenFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            [0, 1, 3, 4],
            childrenAmountsToTransfer,
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: One of the supplied children token IDs is not attached to the parent token"
      );
    });

    it("The transfer must revert if one of the supplied children token amounts exceeds the attached child balance", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildrenFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childrenIDsToTransfer,
            [1, 100, 11, 2],
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: One of the supplied children token amounts exceeds the attached child balance or is zero"
      );
    });

    it("The transfer must revert if one of the supplied children token amounts is zero", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildrenFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childrenIDsToTransfer,
            [1, 100, 0, 2],
            dummyEncodedData
          )
      ).to.be.revertedWith(
        "ERC998ERC1155TD: One of the supplied children token amounts exceeds the attached child balance or is zero"
      );
    });

    it("The batch of ERC1155 tokens has been correctly transfered from the parent composable to the EOA", async () => {
      let childrenContracts;
      let childrenIDs;

      await this.composable
        .connect(this.COMPOSABLE_OWNER)
        .safeTransferChildrenFrom(
          1,
          this.DEFAULT_EOA.address,
          this.multitokens.address,
          childrenIDsToTransfer,
          childrenAmountsToTransfer,
          dummyEncodedData
        );

      childrenContracts = await this.composable.getChildrenContractsOfParent(1);
      childrenIDs =
        await this.composable.getChildrenIDsOfParentForChildContract(
          1,
          this.multitokens.address
        );

      expect(childrenContracts).to.be.an("array").and.empty;
      expect(childrenIDs).to.be.an("array").and.empty;

      for (let i = 0; i < childrenIDs.length; i++) {
        let updatedChildBalance = await this.composable.getChildBalanceOfParent(
          1,
          this.multitokens.address,
          i
        );

        expect(updatedChildBalance).to.equal(0);
      }
    });

    it("ChildrenTransfered event has been emited with the correct arguments ", async () => {
      await expect(
        this.composable
          .connect(this.COMPOSABLE_OWNER)
          .safeTransferChildrenFrom(
            1,
            this.DEFAULT_EOA.address,
            this.multitokens.address,
            childrenIDsToTransfer,
            childrenAmountsToTransfer,
            dummyEncodedData
          )
      )
        .to.emit(this.composable, "ChildrenTransfered")
        .withArgs(
          1,
          this.DEFAULT_EOA.address,
          this.multitokens.address,
          childrenIDsToTransfer,
          childrenAmountsToTransfer
        );
    });
  });
});
