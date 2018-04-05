pragma solidity ^0.4.18;

import './zeppelin/token/ERC20/MintableToken.sol';
import './zeppelin/token/ERC827/ERC827Token.sol';
import './zeppelin/ownership/NoOwner.sol';
import './BurnableToken.sol';
import './AirdropToken.sol';

contract BOBToken is AirdropToken, MintableToken, BurnableToken, NoOwner {
    string public symbol = 'BOB';
    string public name = 'BOB Token';
    uint8 public constant decimals = 18;

    address founder;                //founder address to allow him transfer tokens even when transfers disabled
    bool public transferEnabled;    //allows to dissable transfers while minting and in case of emergency

    function setFounder(address _founder) onlyOwner public {
        founder = _founder;
    }
    function setTransferEnabled(bool enable) onlyOwner public {
        transferEnabled = enable;
    }

    /**
     * Allow transfer only after crowdsale finished
     */
    modifier canTransfer() {
        require( transferEnabled || msg.sender == founder || msg.sender == owner);
        _;
    }
    
    function transfer(address _to, uint256 _value) canTransfer public returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) canTransfer public returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    function transfer(address _to, uint256 _value, bytes _data) canTransfer public returns (bool) {
        return super.transfer(_to, _value, _data);
    }

    function transferFrom(address _from, address _to, uint256 _value, bytes _data) canTransfer public returns (bool) {
        return super.transferFrom(_from, _to, _value, _data);
    }
}

