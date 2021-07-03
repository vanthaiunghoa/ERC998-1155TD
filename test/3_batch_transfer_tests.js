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
      ethers.utils.arrayify(encodedNonExistentParentID);
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
});
