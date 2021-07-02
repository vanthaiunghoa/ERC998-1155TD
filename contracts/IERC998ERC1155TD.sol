// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IERC998ERC1155TD {
    event ChildReceived(
        address indexed _from, 
        uint256 indexed _toParentTokenId, 
        address indexed _childContract, 
        uint256 _childTokenId, 
        uint256 _childTokenAmount
    );


    event ChildrenReceived(
        address indexed _from, 
        uint256 _toParentTokenId, 
        address indexed _childrenTokenContract, 
        uint256[] _childrenTokenIds, 
        uint256[] _childrenTokenAmounts
    );


    event ChildTransfered(
        uint256 indexed _fromParentTokenId, 
        address indexed _to, 
        address indexed _childTokenContract, 
        uint256 _childTokenId, 
        uint256 _childTokenAmount
    );


    event ChildrenTransfered(
        uint256 indexed _fromParentTokenId, 
        address indexed _to, 
        address indexed _childTokenContract, 
        uint256[] _childrenTokenIds, 
        uint256[] _childrenTokenAmounts
    );


    function safeTransferChildFrom(
        uint256 _fromParentTokenId, 
        address _to, 
        address _childTokenContract, 
        uint256 _childTokenId, 
        uint256 _childTokenAmount, 
        bytes calldata _data
    ) 
        external;


    function safeTransferChildrenFrom(
        uint256 _fromParentTokenId, 
        address _to, 
        address _childTokenContract, 
        uint256[] calldata _childrenTokenIds, 
        uint256[] calldata _childrenTokenAmounts, 
        bytes calldata _data
    ) 
        external;


    function getChildBalanceOfParent(
        uint256 _parentTokenId, 
        address _childTokenContract, 
        uint256 _childTokenId
    )
        external
        view
        returns(uint256 _childBalance);


    function getChildrenContractsOfParent(
        uint256 _parentTokenId
    ) 
        external
        view
        returns(address[] memory _childrenTokenContracts);


    function getChildrenIDsOfParentForChildContract(
        uint256 _parentTokenId,
        address _childTokenContract
    ) 
        external
        view
        returns(uint256[] memory _childrenIds);


    function getParentOfChildForContract( 
        address _childTokenContract, 
        uint256 _childTokenId
    )
        external
        view
        returns (uint256 _parentTokenId);

}
