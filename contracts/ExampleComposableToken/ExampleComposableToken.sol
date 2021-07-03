// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../Implementation/ERC998ERC1155TD.sol";

contract ExampleComposableToken is ERC998ERC1155TD, Ownable {
    constructor(string memory _name, string memory _symbol) ERC998ERC1155TD(_name, _symbol) {}

    function mint(address _to, uint256 _tokenID) public onlyOwner {
        _safeMint(_to, _tokenID);
    }
}