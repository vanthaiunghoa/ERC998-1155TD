// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./IERC998ERC1155TD.sol";

contract ERC998ERC1155TD is Context, ERC721URIStorage, ERC1155Holder, IERC998ERC1155TD {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    // parentTokenID => set(childContractAddress)
    mapping(uint256 => EnumerableSet.AddressSet) private _childrenContractsOfParent;
     // parentTokenID => map(childTokenAddress => set(childTokensID))
    mapping(uint256 => mapping(address => EnumerableSet.UintSet)) private _childrenIDsOfParent;
    // parentTokenID => map(childTokenAddress => map(childTokenID => balance))
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) private _childBalanceOfParent;
    // childTokenAddress => map(childTokenID => parentTokenID)
    mapping(address => mapping(uint256 => uint256)) private _parentOfChild;

    string public baseURI;

    constructor(string memory _name, string memory _symbol, string memory _uriBase) ERC721(_name, _symbol) {
        baseURI = _uriBase;
    }


    /**
     * @notice Transfering a child token from a parent token to another contract or EOA
     * @param _fromParentTokenId The parent token ID
     * @param _to The receipient address
     * @param _childTokenContract The address of the child token contract
     * @param _childTokenId The ID of the child token to transfer
     * @param _childTokenAmount The amount of child token to transfer
     * @param _data If _to is another composable token, _data must represent 32 bytes containing an 
     * uint256 representing the receiving parent's token ID
     */
    function safeTransferChildFrom(
        uint256 _fromParentTokenId,
        address _to,
        address _childTokenContract,
        uint256 _childTokenId,
        uint256 _childTokenAmount,
        bytes calldata _data
    ) 
        external
        virtual
        override 
    {
        require(_exists(_fromParentTokenId), 
            "ERC998ERC1155TD: Transfering from a nonexistent parent token"
        );
        require(_childrenIDsOfParent[_fromParentTokenId][_childTokenContract].contains(_childTokenId), 
            "ERC998ERC1155TD: The child token is not attached to the parent token"
        );
        require(ownerOf(_fromParentTokenId) == _msgSender() || isApprovedForAll(ownerOf(_fromParentTokenId), _msgSender()), 
            "ERC998ERC1155TD: msg.sender is not the parent token owner nor approved to transfer the child token"
        );
        require(_childTokenAmount != 0 && _childTokenAmount <= _childBalanceOfParent[_fromParentTokenId][_childTokenContract][_childTokenId], 
            "ERC998ERC1155TD: Child token balance is below requested transfer amount or zero"
        );
        require(_to != address(0) && _to != address(this),
            "ERC998ERC1155TD: Cannot transfer child token to the zero address or self"
        );
        
        _beforeChildTransfer(
            _msgSender(), 
            _fromParentTokenId, 
            address(this), 
            _childTokenContract, 
            _asSingletonUIntArray(_childTokenId), 
            _asSingletonUIntArray(_childTokenAmount), 
            _data
        );

        _detachFromParent(_fromParentTokenId, _childTokenContract, _childTokenId, _childTokenAmount);

        ERC1155(_childTokenContract).safeTransferFrom(address(this), _to, _childTokenId, _childTokenAmount, _data);

        emit ChildTransfered(_fromParentTokenId, _to, _childTokenContract, _childTokenId, _childTokenAmount);
    }

    /**
     * @notice Transfering a batch of children tokens from a parent token to another contract or EOA
     * @param _fromParentTokenId The parent token ID
     * @param _to The receipient address
     * @param _childTokenContract The address of the child token contract
     * @param _childrenTokenIds The IDs of the children tokens to transfer
     * @param _childrenTokenAmounts The amounts of children tokens to transfer
     * @param _data If _to is another composable token, _data must represent 32 bytes containing an 
     * uint256 representing the receiving parent's token ID
     */
    function safeTransferChildrenFrom(
        uint256 _fromParentTokenId, 
        address _to, 
        address _childTokenContract, 
        uint256[] calldata _childrenTokenIds, 
        uint256[] calldata _childrenTokenAmounts, 
        bytes calldata _data
    ) 
        external
        virtual
        override 
    {
        require(_exists(_fromParentTokenId), 
            "ERC998ERC1155TD: Transfering from a nonexistent parent token"
        );
        require(ownerOf(_fromParentTokenId) == _msgSender() || isApprovedForAll(ownerOf(_fromParentTokenId), _msgSender()), 
            "ERC998ERC1155TD: msg.sender is not the parent token owner nor approved to transfer the children tokens"
        );
        require(_childrenTokenIds.length == _childrenTokenAmounts.length, 
            "ERC998ERC1155TD: Child tokens amounts and IDs arrays size mismatch"
        );
        require(_to != address(0) && _to != address(this),
            "ERC998ERC1155TD: Cannot transfer child token to the zero address or self"
        );

        for (uint256 i = 0; i < _childrenTokenIds.length; i++) {
            require(_childrenIDsOfParent[_fromParentTokenId][_childTokenContract].contains(_childrenTokenIds[i]), 
                "ERC998ERC1155TD: One of the supplied children token IDs is not attached to the parent token"
            );
            require(_childrenTokenAmounts[i] != 0 && _childrenTokenAmounts[i] <= _childBalanceOfParent[_fromParentTokenId][_childTokenContract][_childrenTokenIds[i]], 
                "ERC998ERC1155TD: One of the supplied children token amounts exceeds the attached child balance or is zero"
            );

            _beforeChildTransfer(
                _msgSender(), 
                _fromParentTokenId, 
                address(this), 
                _childTokenContract, 
                _asSingletonUIntArray(_childrenTokenIds[i]),
                _asSingletonUIntArray(_childrenTokenAmounts[i]), 
                _data
            );

            _detachFromParent(_fromParentTokenId, _childTokenContract, _childrenTokenIds[i], _childrenTokenAmounts[i]);
        }

        ERC1155(_childTokenContract).safeBatchTransferFrom(address(this), _to, _childrenTokenIds, _childrenTokenAmounts, _data);

        emit ChildrenTransfered(_fromParentTokenId, _to, _childTokenContract, _childrenTokenIds, _childrenTokenAmounts);
    }


    /**
     * @notice A composable receives a child token (ERC1155Holder|ERC1155Receiver)
     * @dev An ERC1155-compliant smart contract MUST call this function on this recipient contract 
     * at the end of a `safeTransferFrom()` and after the balance has been updated.
     * @param _operator The address of the account/contract that initiated the transfer
     * @param _from The address of the holder whose balance is decreased
     * @param _childTokenId The ID of the child token being transferred
     * @param _childTokenAmount The amount of token being transferred
     * @param _data 32 bytes containing an uint256 representing the receiving parent's token ID
     */
    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _childTokenId,
        uint256 _childTokenAmount,
        bytes memory _data
    ) 
        public 
        virtual 
        override(ERC1155Holder)
        returns(bytes4)
    {
        require(_data.length == 32, "ERC998ERC1155TD: Data argument must contain the receiving parent token ID as uint256");

        uint256 parentTokenId;

        assembly {
            parentTokenId := calldataload(sub(calldatasize(), 0x20))
        }
        
        require(_exists(parentTokenId), "ERC998ERC1155TD: Attaching to a nonexistent parent token");

        _beforeChildTransfer(
            _operator, 
            parentTokenId, 
            address(this), 
            _msgSender(), 
            _asSingletonUIntArray(_childTokenId), 
            _asSingletonUIntArray(_childTokenAmount), 
            _data
        );
        
        _attachToParent(parentTokenId, _msgSender(), _childTokenId, _childTokenAmount);
        
        emit ChildReceived(_from, parentTokenId, _msgSender(),  _childTokenId, _childTokenAmount);
        
        return this.onERC1155Received.selector;
    }


    /**
     * @notice A composable receives a batch of children tokens (ERC1155Holder|ERC1155Receiver)
     * @dev An ERC1155-compliant smart contract MUST call this function on this recipient contract 
     * at the end of a `safeTransferFrom()` and after the balance has been updated.
     * @param _operator The address of the account/contract that initiated the transfer
     * @param _from The address of the holder whose balances are decreased
     * @param _childrenTokenIds The tokens IDs that are being transferred to the parent
     * @param _childrenTokenAmounts The amounts of tokens that are being transferred to the parent
     * @param _data 32 bytes containing an uint256 representing the receiving parent's token ID
     */
    function onERC1155BatchReceived(
        address _operator,
        address _from,
        uint256[] memory _childrenTokenIds,
        uint256[] memory _childrenTokenAmounts,
        bytes memory _data
    ) 
        public 
        virtual 
        override(ERC1155Holder) 
        returns(bytes4) 
    {
        require(_data.length == 32, "ERC998ERC1155TD: Data argument must contain the receiving parent token ID as uint256");

        uint256 parentTokenId;

        assembly {
            parentTokenId := calldataload(sub(calldatasize(), 0x20))
        }

        require(_exists(parentTokenId), "ERC998ERC1155TD: Attaching to a nonexistent parent token");
        require(_childrenTokenIds.length == _childrenTokenAmounts.length, "ERC998ERC1155TD: Child tokens amounts and IDs arrays size mismatch");
        
        for (uint256 i = 0; i < _childrenTokenIds.length; i++) {
            _beforeChildTransfer(
                _operator, 
                parentTokenId, 
                address(this), 
                _msgSender(), 
                _asSingletonUIntArray(_childrenTokenIds[i]), 
                _asSingletonUIntArray(_childrenTokenAmounts[i]), 
                _data
            );

            _attachToParent(parentTokenId, _msgSender(), _childrenTokenIds[i], _childrenTokenAmounts[i]);
        }

        emit ChildrenReceived(_from, parentTokenId, _msgSender(), _childrenTokenIds, _childrenTokenAmounts);

        return this.onERC1155BatchReceived.selector;
    }


    /**
     * @notice (see ERC165)
     * @param _interfaceId The ID of the interface to check for support
     * @return Returns true if this contract implements the interface defined by _interfaceId
     */
    function supportsInterface(bytes4 _interfaceId)
        public
        view
        virtual
        override(ERC721, ERC1155Receiver)
        returns(bool)
    {
        return _interfaceId == type(IERC1155Receiver).interfaceId 
            || _interfaceId == type(IERC721).interfaceId 
            || _interfaceId == type(IERC721Metadata).interfaceId 
            || super.supportsInterface(_interfaceId);
    }


    /**
     * @notice Returns the balance of a single child token currently attached to a parent
     * @param _parentTokenId The ID of the parent token
     * @param _childTokenContract The contract address of the child token
     * @param _childTokenId The ID of the child token
     * @return _childBalance The balance of the child token attached to the parent
     */
    function getChildBalanceOfParent(
        uint256 _parentTokenId, 
        address _childTokenContract, 
        uint256 _childTokenId
    )
        external
        view
        virtual
        override
        returns(uint256 _childBalance)
    {
        _childBalance = _childBalanceOfParent[_parentTokenId][_childTokenContract][_childTokenId];
    }


    /**
     * @notice Returns a list of children contract addresses currently attached to a given parent token
     * @param _parentTokenId The ID of the parent token
     * @return _childrenTokenContracts The children contract addresses
     */
    function getChildrenContractsOfParent(
        uint256 _parentTokenId
    ) 
        external
        view
        virtual
        override
        returns(address[] memory _childrenTokenContracts) 
    {
        address[] memory entries = new address[](_childrenContractsOfParent[_parentTokenId].length());
        
        for (uint256 i = 0; i < _childrenContractsOfParent[_parentTokenId].length(); i++) {
            entries[i] = _childrenContractsOfParent[_parentTokenId].at(i);
        }

        _childrenTokenContracts = entries;
    }

    function getChildrenIDsOfParentForChildContract(
        uint256 _parentTokenId,
        address _childTokenContract
    ) 
        external
        view
        virtual
        override
        returns(uint256[] memory _childrenIds) 
    {
        uint256[] memory entries = new uint256[](_childrenIDsOfParent[_parentTokenId][_childTokenContract].length());
        
        for (uint256 i = 0; i < _childrenIDsOfParent[_parentTokenId][_childTokenContract].length(); i++) {
            entries[i] = _childrenIDsOfParent[_parentTokenId][_childTokenContract].at(i);
        }

        _childrenIds = entries;
    }


    /**
     * @notice Returns the parent token ID of a given child token
     * @param _childTokenContract The child token contract address
     * @param _childTokenId The child token ID
     * @return _parentTokenId The parent token ID 
     */
    function getParentOfChildForContract( 
        address _childTokenContract, 
        uint256 _childTokenId
    )
        external
        view
        virtual
        override
        returns(uint256 _parentTokenId)
    {
        _parentTokenId = _parentOfChild[_childTokenContract][_childTokenId];
    }


    /**
     * @notice Attach a child token to a parent token
     * @param _parentTokenId The ID of the parent token
     * @param _childTokenContract The contract address of the child token
     * @param _childTokenId The ID of the child token
     * @param _childTokenAmount The amount of child token to attach
     */
    function _attachToParent(
        uint256 _parentTokenId,
        address _childTokenContract,
        uint256 _childTokenId,
        uint256 _childTokenAmount
    ) 
        internal
        virtual 
    {   
        _childrenContractsOfParent[_parentTokenId].add( _childTokenContract);
        _childrenIDsOfParent[_parentTokenId][_childTokenContract].add(_childTokenId);
        _childBalanceOfParent[_parentTokenId][_childTokenContract][_childTokenId] += _childTokenAmount;
        _parentOfChild[_childTokenContract][_childTokenId] = _parentTokenId;
    }


    /**
     * @notice Detach a child token from a parent token
     * @param _parentTokenId The ID of the parent token
     * @param _childTokenContract The contract address of the child token
     * @param _childTokenId The ID of the child token
     * @param _childTokenAmount The amount of child token to detach
     */
    function _detachFromParent(
        uint256 _parentTokenId,
        address _childTokenContract,
        uint256 _childTokenId,
        uint256 _childTokenAmount
    ) 
        internal
        virtual
    {
        _childBalanceOfParent[_parentTokenId][_childTokenContract][_childTokenId] -= _childTokenAmount;

        if (_childBalanceOfParent[_parentTokenId][_childTokenContract][_childTokenId] == 0) {
            _childrenIDsOfParent[_parentTokenId][_childTokenContract].remove(_childTokenId);

            if (_childrenIDsOfParent[_parentTokenId][_childTokenContract].length() == 0) {
                _childrenContractsOfParent[_parentTokenId].remove(_childTokenContract);
            }

            delete _parentOfChild[_childTokenContract][_childTokenId];
        }
    }


    /**
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning, as well as batched variants.
     * The same hook is called on both single and batched variants. For single
     * transfers, the length of the `_childrenTokenIds` and `_childrenTokenAmounts` arrays will be 1.
     * To learn more about hooks: 
     * https://docs.openzeppelin.com/contracts/4.x/extending-contracts#rules_of_hooks
     */
    function _beforeChildTransfer(
        address _operator,
        uint256 _parentTokenId,
        address _to,
        address childTokenContract,
        uint256[] memory _childrenTokenIds,
        uint256[] memory _childrenTokenAmounts,
        bytes memory _data
    )
        internal 
        virtual
    { }


    function _baseURI() 
        internal
        view 
        virtual
        override 
        returns(string memory) 
    {
        return baseURI;
    }


    function _asSingletonUIntArray(uint256 element) 
        private 
        pure 
        returns (uint256[] memory) 
    {
        uint256[] memory array = new uint256[](1);
        array[0] = element;

        return array;
    }


    // FOR TESTS
    function mint(address _to, uint256 _tokenID) public {
        _safeMint(_to, _tokenID);
    }

}
