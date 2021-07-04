# ERC998-ERC1155 "TopDown" Composable Token basic implementation

## Description
A basic implementation of the *ERC998-ERC1155 Composable Token*. This implementation gives the ability to an *ERC721* token to own multiple *ERC1155* tokens (fungibles and/or non-fungibles).
>This implementation relies on the OpenZeppelin's *ERC721.sol* to define the composable token as well as the *ERC1155.sol* implementation and the *ERC1155Holder.sol* utility to handle the transfers of *ERC1155* tokens from and to a parent composable token.

## Usage
>This implementation is agnostic to the way composable tokens are created. This means that a supply mechanism has to be added in a derived contract using *{_mint}* from the herited ERC721 contract. For a generic supply mechanism see OpenZeppelin's preset: *ERC721PresetMinterPauserAutoId.sol*.

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "../Implementation/ERC998ERC1155TD.sol";

contract ExampleComposableToken is ERC998ERC1155TD, Ownable {
    constructor(string memory _name, string memory _symbol) ERC998ERC1155TD(_name, _symbol) {
        // Your init code
    }

    function mint(address _to, uint256 _tokenID) public onlyOwner {
        _safeMint(_to, _tokenID);
    }
}
```

## Hardhat Project Setup
This repo is a Hardhat project and thus, you need to download and install the dependencies to be able to compile the contracts and run the tests inside the 
Hardhat environment. All the tests are written using *hardhat-ethers* and *Chai*.

First you need to clone this repo:
```
$ git clone https://github.com/NaviNavu/ERC998-1155TD.git
```
Make sure you have npm installed then move inside the previously cloned directory and run:
```$ npm install```

## Tests
In order to run the tests located inside the *test/* directory just run inside the project's root directory:
```$ npx hardhat test```

>You are not required to compile or deploy anything before running the *test* command as HardHat will handle it for you.