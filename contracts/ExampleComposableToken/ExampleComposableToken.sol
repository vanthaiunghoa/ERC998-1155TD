// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "../Implementation/ERC998ERC1155TD.sol";

contract ExampleComposableToken is ERC998ERC1155TD {
    constructor(string memory _name, string memory _symbol, string memory _uriBase) ERC998ERC1155TD(_name, _symbol, _uriBase) {
        baseURI = _uriBase;
    }

    
    function mint(address _to, uint256 _tokenID) public {
        _safeMint(_to, _tokenID);
    }
}