pragma solidity ^0.4.18;

import './zeppelin/ownership/Ownable.sol';
import './zeppelin/ownership/HasNoEther.sol';
import './zeppelin/ownership/HasNoContracts.sol';
import './zeppelin/ownership/CanReclaimToken.sol';
import './zeppelin/lifecycle/Destructible.sol';
import './zeppelin/math/SafeMath.sol';
import './BOBToken.sol';
import './BOBTokenVesting.sol';


contract BOBCrowdsale is Ownable, HasNoEther, HasNoContracts, CanReclaimToken, Destructible {
    using SafeMath for uint256;

    event VestingWalletCreated(address indexed beneficiary, address wallet, uint256 amount, string description);

    BOBToken public token;
    mapping(address=>uint256) distributed;    //Maps amount of tokens sent to purchaser to his address. Used to prevent double-minting

    uint256 public tokensMinted;
    uint256 public tokensCap;

    function BOBCrowdsale(uint256 _tokensCap) public {
        require(_tokensCap > 0);
        tokensCap = _tokensCap;
        token = new BOBToken();
        token.setFounder(owner);
        token.setTransferEnabled(false);
    }

    function distributedTo(address beneficiary) view public returns(uint256) {
        return distributed[beneficiary];
    }

    /**
     * @notice Mint tokens
     * @param beneficiary Who will receive tokens
     * @param amount How many tokens should me minted
     * @param vestingStart When vesting should start (beneficieary can not recieve tokens untill this time), should be 0 if no vesting
     * @param vestingDuration How long tokens shoud be vested (0 if no vesting)
     * @param revocable If owner can revoke tokens
     * @param description Why tokens are minted
     */
    function mint(address beneficiary, uint256 amount, uint256 vestingStart, uint256 vestingDuration, bool revocable, string description) onlyOwner external returns(bool){
        if(vestingDuration == 0) {
            require(vestingStart == 0);
            mintTokens(beneficiary, amount);
        }else{
            require(now < vestingStart.add(vestingDuration));
            BOBTokenVesting vesting = new BOBTokenVesting(beneficiary, vestingStart, 0, vestingDuration, revocable);
            mintTokens(vesting, amount);
            VestingWalletCreated(beneficiary, address(vesting) , amount, description);
            vesting.transferOwnership(owner);
        }
        return true;
    }

    /**
    * @notice Distribute tokens sold
    * @param beneficiaries Array of beneficiary addresses
    * @param amounts Array of amounts of tokens to send
    */
    function distributeTokens(address[] beneficiaries, uint256[] amounts) onlyOwner external returns(bool){
        require(beneficiaries.length == amounts.length);
        for(uint256 i=0; i<beneficiaries.length; i++){
            uint256 requestedTokens = amounts[i];
            address bf = beneficiaries[i];
            uint256 dt = distributed[bf];
            require(requestedTokens >= dt);   //If this is not true, when we have an error in our table (because we can not withdraw already minted tokens) and have to so smth. about it
            if(requestedTokens > dt) {
                mintTokens(bf, requestedTokens.sub(dt));
                distributed[bf] = requestedTokens;
            }            
        }
        return true;
    }

    /**
    * @notice Finalize crowdsale: stop minting, allow token transfers, transfer ownership of the token
    */
    function finalizeCrowdsale() onlyOwner public  {
        token.finishMinting();
        token.setTransferEnabled(true);
        token.transferOwnership(owner);
    }


    /**
    * @dev Helper function to mint tokens and increase tokensMinted counter
    */
    function mintTokens(address beneficiary, uint256 amount) internal {
        tokensMinted = tokensMinted.add(amount);
        require(tokensMinted <= tokensCap);
        assert(token.mint(beneficiary, amount));
    }

}