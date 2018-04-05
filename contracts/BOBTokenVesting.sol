pragma solidity ^0.4.18;

import './zeppelin/lifecycle/Destructible.sol';
import './zeppelin/ownership/HasNoEther.sol';
import './zeppelin/ownership/HasNoContracts.sol';
import './zeppelin/token/ERC20/TokenVesting.sol';

/**
 * @title BOBTokenVesting
 * @dev Extends TokenVesting contract to allow reclaim ether and contracts, if transfered to this by mistake.
 */
contract BOBTokenVesting is TokenVesting, HasNoEther, HasNoContracts, Destructible {

    /**
     * @dev Call consturctor of TokenVesting with exactly same parameters
     */
    function BOBTokenVesting(address _beneficiary, uint256 _start, uint256 _cliff, uint256 _duration, bool _revocable) 
                TokenVesting(        _beneficiary,         _start,         _cliff,         _duration,      _revocable) public {}

}