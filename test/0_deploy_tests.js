const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC998-ERC1155 Topdown deployment tests", () => {
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
    );

    this.multitokens = await MultiTokens.deploy();

    await this.composable.mint(this.COMPOSABLE_OWNER.address, 1);
    await this.multitokens.mint(this.MULTITOKENS_OWNER.address, 1);
  });

  describe("Deployments", () => {
    it("Multitokens contract is deployed on local chain", async () => {
      expect(await this.multitokens.deployed()).to.be.ok;
    });

    it("Composable token contract is deployed on local chain", async () => {
      expect(await this.composable.deployed()).to.be.ok;
    });
  });

  describe("Constructor arguments integrity", () => {
    it("Composable constructor arguments are correctly set", async () => {
      const name = await this.composable.name();
      const symb = await this.composable.symbol();

      expect(name).to.equal("Composable Token");
      expect(symb).to.equal("CTKN");
    });
  });
});
