pragma solidity ^0.4.18;

import './PausableERC827Token.sol';

/**
 * @title Airdroppable Token
 */
contract AirdropToken is PausableERC827Token {
    using SafeMath for uint256;
    uint8 private constant PERCENT_DIVIDER = 100;  

    event AirdropStart(uint256 multiplierPercent, uint256 airdropNumber);
    event AirdropComplete(uint256 airdropNumber);

    uint256 public multiplierPercent = 0;               //Multiplier of current airdrop (for example, multiplierPercent = 200 and holder balance is 1 TOKEN, after airdrop it will be 2 TOKEN)
    uint256 public currentAirdrop = 0;                  //Number of current airdrop. If 0 - no airdrop started
    uint256 public undropped;                           //Amount not yet airdropped
    mapping(address => uint256) public airdropped;        //map of alreday airdropped addresses       

    /**
    * @notice Start airdrop
    * @param _multiplierPercent Multiplier of the airdrop
    */
    function startAirdrop(uint256 _multiplierPercent) onlyOwner external returns(bool){
        pause();
        require(multiplierPercent == 0);                 //This means airdrop was finished
        require(_multiplierPercent > PERCENT_DIVIDER);   //Require that after airdrop amount of tokens will be greater than before
        currentAirdrop = currentAirdrop.add(1);
        multiplierPercent = _multiplierPercent;
        undropped = totalSupply();
        assert(multiplierPercent.mul(undropped) > 0);   //Assert that wrong multiplier will not result in owerflow in airdropAmount()
        AirdropStart(multiplierPercent, currentAirdrop);
    }
    /**
    * @notice Finish airdrop, unpause token transfers
    * @dev Anyone can call this function after all addresses are airdropped
    */
    function finishAirdrop() external returns(bool){
        require(undropped == 0);
        multiplierPercent = 0;
        AirdropComplete(currentAirdrop);
        unpause();
    }

    /**
    * @notice Execute airdrop for a bunch of addresses. Should be repeated for all addresses with non-zero amount of tokens.
    * @dev This function can be called by anyone, not only the owner
    * @param holders Array of token holder addresses.
    * @return true if success
    */
    function drop(address[] holders) external returns(bool){
        for(uint256 i=0; i < holders.length; i++){
            address holder = holders[i];
            if(!isAirdropped(holder)){
                uint256 balance = balances[holder];
                undropped = undropped.sub(balance);
                balances[holder] = airdropAmount(balance);
                uint256 amount = balances[holder].sub(balance);
                totalSupply_ = totalSupply_.add(amount);
                Transfer(address(0), holder, amount);
                setAirdropped(holder);
            }
        }
    }
    /**
    * @notice Calculates amount of tokens after airdrop
    * @param amount Balance before airdrop
    * @return Amount of tokens after airdrop
    */
    function airdropAmount(uint256 amount) view public returns(uint256){
        require(multiplierPercent > 0);
        return multiplierPercent.mul(amount).div(PERCENT_DIVIDER);
    }

    /**
    * @dev Check if address was already airdropped
    * @param holder Address of token holder
    * @return true if address was airdropped
    */
    function isAirdropped(address holder) view internal returns(bool){
        return (airdropped[holder] == currentAirdrop);
    }
    /**
    * @dev Mark address as airdropped
    * @param holder Address of token holder
    */
    function setAirdropped(address holder) internal {
        airdropped[holder] = currentAirdrop;
    }


}