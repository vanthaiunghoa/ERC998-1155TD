const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC998-ERC1155 Topdown minting tests", () => {
  before(async () => {
    let signers = await ethers.getSigners();

    this.DEPLOYER = signers[0];
    this.COMPOSABLE_OWNER = signers[1];
    this.MULTITOKENS_OWNER = signers[2];
    this.DEFAULT_EOA = signers[3];
  });

  beforeEach(async () => {
    const Composable = await ethers.getContractFactory("ExampleComposableToken");

    this.composable = await Composable.deploy(
      "Composable Token",
      "CTKN"
    );
  });

  describe("Minting", () => {
    it("A composable token has been correctly minted to COMPOSABLE_OWNER address", async () => {
      await this.composable.mint(this.COMPOSABLE_OWNER.address, 1);

      expect(await this.composable.ownerOf(1)).to.equal(
        this.COMPOSABLE_OWNER.address
      );
      expect(
        parseInt(await this.composable.balanceOf(this.COMPOSABLE_OWNER.address))
      ).to.equal(1);
    });
  });
});
