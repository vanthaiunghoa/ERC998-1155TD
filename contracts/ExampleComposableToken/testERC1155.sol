// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract testERC1155 is ERC1155 {
    constructor() ERC1155("https://game.example/api/item/{id}.json") {}

    // FOR TESTING
    function mint(address _to, uint256 _tokenID) public {
        _mint(_to, _tokenID, 1, "");
    }
    function mintBatch(address _to, uint256[] memory _ids, uint256[] memory _amounts, bytes memory _data) public {
        _mintBatch(_to, _ids, _amounts, _data);
    }
}