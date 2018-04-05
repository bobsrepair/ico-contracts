var $ = jQuery;
jQuery(document).ready(function($) {

    let web3 = null;
    let tokenContract = null;
    let crowdsaleContract = null;
    let vestingContract = null;


    setTimeout(init, 1000);
    async function init(){
        web3 = await loadWeb3();
        if(web3 == null) {
            setTimeout(init, 5000);
            return;
        }
        loadContract('./build/contracts/BOBToken.json', function(data){
            tokenContract = data;
            $('#tokenABI').text(JSON.stringify(data.abi));
        });
        loadContract('./build/contracts/BOBCrowdsale.json', function(data){
            crowdsaleContract = data;
            $('#crowdsaleABI').text(JSON.stringify(data.abi));
            initManageForm();
        });
        loadContract('./build/contracts/TokenVesting.json', function(data){
            vestingContract = data;
        });

        setInterval(function(){$('#clock').val( (new Date()).toISOString() )}, 1000);
        initPublishForm();
    }

    function initPublishForm(){
        let form = $('#publishContractsForm');
        $('input[name=tokensCap]', form).val(360000000);

    }
    function initManageForm(){
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = getUrlParam('crowdsale');
        if(web3.utils.isAddress(crowdsaleAddress)){
            $('input[name=crowdsaleAddress]', form).val(crowdsaleAddress);
            $('#loadCrowdsaleInfo').click();
        }
        let tokenAddress = getUrlParam('token');
        if(web3.utils.isAddress(tokenAddress)){
            $('input[name=tokenAddress]',$('#manageToken')).val(tokenAddress);
            $('#loadTokenInfo').click();
        }
        

        let d = new Date();
        let nowTimestamp = d.setMinutes(0, 0, 0);
        d = new Date(nowTimestamp+1*60*60*1000);
        $('input[name=vestingStart]', form).val(d.toISOString());
        d = new Date(nowTimestamp+(18*30*24 + 1)*60*60*1000);
        $('input[name=vestingEnd]', form).val(d.toISOString());

        $('input[name=beneficiary]', form).val(web3.eth.defaultAccount);

        $('input[name=multiplier]',$('#manageToken')).val(2);

    }


    $('#publishCrowdsale').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#publishContractsForm');


        let tokensCap = web3.utils.toWei($('input[name=tokensCap]',form).val());

        let args = [tokensCap];
        console.log('Publishing '+crowdsaleContract.contractName+' with arguments:', args);

        let crowdsaleObj = new web3.eth.Contract(crowdsaleContract.abi);
        crowdsaleObj.deploy({
            data: crowdsaleContract.bytecode,
            arguments: args
        })
        .send({
            from: web3.eth.defaultAccount,
        })
        .on('error',function(error){
            console.log('Publishing failed: ', error);
            printError(error);
        })
        .on('transactionHash',function(tx){
            $('input[name=publishedTx]',form).val(tx);
        })
        .on('receipt',function(receipt){
            let crowdsaleAddress = receipt.contractAddress;
            $('input[name=publishedAddress]',form).val(crowdsaleAddress);
            $('input[name=crowdsaleAddress]','#manageCrowdsale').val(crowdsaleAddress);
            $('#loadCrowdsaleInfo').click();
        })
        .then(function(contractInstance){
            console.log('Crowdsale contract address: ', contractInstance.options.address) // instance with the new contract address
            let crowdsaleInstance = loadContractInstance(crowdsaleContract, contractInstance.options.address);
            return crowdsaleInstance.methods.token().call()
            .then(function(result){
                $('input[name=tokenAddress]',form).val(result);
                $('input[name=tokenAddress]',$('#manageToken')).val(result);
                $('#loadTokenInfo').click();
            });
        });

    });


    $('#loadCrowdsaleInfo').click(async function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        let tokenAddress = await crowdsaleInstance.methods.token().call();
        let tokenInstance = loadContractInstance(tokenContract, tokenAddress);
        $('input[name=tokenAddress]',form).val(tokenAddress);
        $('input[name=tokenAddress]',$('#manageToken')).val(tokenAddress);
        
        crowdsaleInstance.methods.tokensMinted().call().then(function(result){
            $('input[name=tokensMinted]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.tokensCap().call().then(function(result){
            $('input[name=tokensCap]',form).val(web3.utils.fromWei(result));
        });
        tokenInstance.methods.totalSupply().call().then(function(result){
            $('input[name=tokenTotalSupply]',form).val(web3.utils.fromWei(result));
        });
        tokenInstance.methods.owner().call().then(function(result){
            $('input[name=tokenOwner]',form).val(result);
        });
        tokenInstance.methods.mintingFinished().call().then(function(result){
            $('input[name=tokenMintingFinished]',form).val(result?'yes':'no');
        });
        tokenInstance.methods.transferEnabled().call().then(function(result){
            $('input[name=tokenTransferEnabled]',form).val(result?'yes':'no');
        });

        $('#loadTokenInfo').click();

        crowdsaleInstance.getPastEvents('VestingWalletCreated',{
            'fromBlock':0,
            'toBlock':'latest'
        }).then(function(events){
            let tableBody = $('#vestingWallets tbody', form);
            tableBody.empty();
            events.forEach(async function(eventEntry){
                let evt = eventEntry.returnValues;
                let walletInstance = loadContractInstance(vestingContract, evt.wallet);
                let releasable = await walletInstance.methods.releasableAmount(tokenAddress).call();
                tableBody.append('<tr><td>'+evt.wallet+'</td><td>'+evt.description+'</td><td>'+evt.beneficiary+'</td><td>'+Math.round(web3.utils.fromWei(releasable))+'</td><td><input type="button" value="Release" class="vestingReleaseButton" data-wallet="'+evt.wallet+'"></td></tr>');
            });
            return events;
        });
    });
    $('#vestingWallets').on('click', '.vestingReleaseButton', async function(el){
        let form = $('#manageCrowdsale');
        let tokenAddress = $('input[name=tokenAddress]',form).val();
        if(!web3.utils.isAddress(tokenAddress)) {console.error('Bad token address', tokenAddress); return;}
        let walletAddress = $(this).data('wallet');
        //console.log(walletAddress);
        let walletInstance = loadContractInstance(vestingContract, walletAddress);
        let releasable = await walletInstance.methods.releasableAmount(tokenAddress).call();
        console.log('Releasing '+web3.utils.fromWei(releasable)+' BOB ('+tokenAddress+')');
        walletInstance.methods.release(tokenAddress).send({
            from: web3.eth.defaultAccount
        })
        .on('transactionHash', function(hash){
            console.log('Vesting wallet '+walletAddress+' release transaction tx: '+hash);
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });
    });
    $('#crowdsaleFinalize').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        crowdsaleInstance.methods.finalizeCrowdsale().send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(hash){
            console.log('Finalize transaction tx: '+hash);
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });

    });

    $('#mintTokens').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;


        let beneficiary = $('input[name=beneficiary]', form).val();
        if(!web3.utils.isAddress(beneficiary)){ printError('Bad beneficiary address'); return; }
        if($('input[name=amount]', form).val() == ''){ printError('Empty amount'); return; }
        let amount = web3.utils.toWei($('input[name=amount]', form).val(), 'ether');
        if(typeof amount == 'undefined' || amount <= 0 ) { printError('Bad amount'); return; }

        let vestingStartStr = $('input[name=vestingStart]', form).val();
        let vestingEndStr = $('input[name=vestingEnd]', form).val();
        let vestingStart, vestingDuration;
        if(vestingStartStr == '' || vestingEndStr == ''){
            if(vestingStartStr != '' || vestingEndStr != ''){
                printError('If no vesting required <b>both</b> vesting start and end should be empty');
                return;
            }
            vestingStart = 0;
            vestingDuration = 0;
        }else{
            vestingStart = timeStringToTimestamp(vestingStartStr);
            let vestingEnd = timeStringToTimestamp(vestingEndStr);
            vestingDuration = vestingEnd - vestingStart;
            //console.log(vestingStart, vestingEnd, vestingDuration);
            if(vestingDuration <= 0) { printError('Bad vesting start/end dates'); return; }
        }
        let revocable = ($('input[name=revocable]:checked', form).val() == 'true');
        let description = $('input[name=description]', form).val();



        console.log('Minting tokens with arguments:', beneficiary, amount, vestingStart, vestingDuration, revocable, description);
        crowdsaleInstance.methods.mint(beneficiary, amount, vestingStart, vestingDuration, revocable, description).send({
            from: web3.eth.defaultAccount,
        })
        .on('error',function(error){
            console.log('Minting failed: ', error);
            printError(error);
        })
        .on('transactionHash',function(tx){
            $('input[name=publishedTx]',form).val(tx);
        })
        .on('receipt',function(receipt){
            console.log('Minting tx published', receipt);
            if(!!receipt.events && !!receipt.events.VestingWalletCreated){
                $('input[name=walletAddress]',form).val(receipt.events.VestingWalletCreated.returnValues.wallet);
            }else if(vestingDuration == 0){
                $('input[name=walletAddress]',form).val(beneficiary);
            }
            $('#loadCrowdsaleInfo').click();  
        });

    });


    $('#parseDistributionCSV').click(function(){
        let form = $('#manageCrowdsale');

        let tableBody = $('#parsedDistributionList tbody', form);
        tableBody.empty(); $('#parseDistributionResult', form).empty(); $('#distributionPrepareData').hide();

        let csv = parseCSV($('textarea[name=distributionCSV]',form).val());
        //console.log(csv);

        let parsedAddresses = new Array();
        let parsedValues = new Array();
        let totalAmount = new web3.utils.BN();
        let failedLines = 0;
        for(let i=0; i < csv.length; i++){
            let lineText = csv[i];
            let address, weiValue;
            if(!web3.utils.isAddress(lineText[0])){
                tableBody.append('<tr><td colspan="2" class="error">Not an address: '+htmlEntities(lineText[0])+'</td></tr>');
                failedLines++;
                continue;
            }else{
                address = lineText[0];
            }
            let value = lineText[1].replace(',','.');
            try {
                weiValue = web3.utils.toWei(value);
            }catch(err){
                console.log('Can not convert value on line '+i+' to wei', err);
                tableBody.append('<tr><td colspan="2" class="error">Not a number: '+htmlEntities(lineText[1])+'</td></tr>');
                failedLines++;
                continue;
            }
            totalAmount = totalAmount.add(web3.utils.toBN(weiValue));
            tableBody.append('<tr data-address="'+address+'"><td>'+(i+1)+'</td><td>'+address+'</td><td>'+web3.utils.fromWei(weiValue)+'</td><td></td></tr>');
            parsedAddresses.push(address);
            parsedValues.push(weiValue);
        }
        $('#parseDistributionResult', form).append('Found '+parsedAddresses.length+' addresses. Total distribution amount: '+web3.utils.fromWei(totalAmount)+' BOB.');
        $('#distributionPrepareData').show();
        //$('#distributionJSON').show();
        let args = {
            'beneficiaries': parsedAddresses,
            'amounts': parsedValues
        }
        console.log('Parsed distribution list:', args);
        $('#distributionJSON').val(JSON.stringify(args))

        setTimeout(function(){
            distributionReadDistributed(parsedAddresses);
        }, 1000);
    });
    $('#executeDistribution').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let distributionLog = $('#distributionLog');
        distributionLog.html('');
        let sendStart = Number($('input[name=sendStart]', form).val());
        let sendLimit = Number($('input[name=sendLimit]', form).val());
        if(Number(sendLimit) <= 0) {
            console.log('Bad send limit: '+sendLimit); return;
        }

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        let distributionData = JSON.parse($('#distributionJSON').val());
        if(distributionData.beneficiaries.length == 0 || distributionData.beneficiaries.length != distributionData.amounts.length) {
            printError('Bad distribution data. See console log for details');
            alert('Bad distribution data. See console log for details');
            console.log('Bad distribution data', distributionData);
            return;
        }
        
        distributionLog.append('<div>Starting distribution to '+distributionData.beneficiaries.length+' addresses in batches of '+sendLimit+' addresses per transaction, starting from address '+sendStart+'.</div>');
        function sendTokens(start) {
            let end = start+sendLimit;
            if(end > distributionData.beneficiaries.length) end = distributionData.beneficiaries.length;
            if(start >= end) {
                console.error('Start >= End!', start, sendLimit, end); return;
            }
            let addressList = distributionData.beneficiaries.slice(start, start+sendLimit);
            let amountList = distributionData.amounts.slice(start, start+sendLimit);
            console.log('Sending tokens to addresses '+start+' - '+end, addressList, amountList);
            let tx = null;
            crowdsaleInstance.methods.distributeTokens(addressList, amountList).send({
                from: web3.eth.defaultAccount,
            })
            .on('transactionHash', function(hash){
                tx = hash;
                distributionLog.append('<div>Transaction <i>'+tx+'</i>: addresses '+start+' - '+end+' published.</div>');
                if(end != distributionData.beneficiaries.length){
                    sendTokens(end);
                }else{
                    $('#executeDistribution').attr('disabled', false);
                }
            })
            .on('receipt', function(receipt){
                distributionLog.append('<div>Transaction <i>'+receipt.transactionHash+'</i> ('+start+' - '+end+') mined.</div>');
                $('#loadCrowdsaleInfo').click();
                distributionReadDistributed(addressList);
            })
            .on('error', function(error){
                console.log('Error sending to addresses '+start+' - '+end+((tx==null)?'':', tx '+tx), error);
                $('#executeDistribution').attr('disabled', false);
            });
        }
        $('#executeDistribution').attr('disabled', true);
        sendTokens(sendStart);
    });

    function distributionReadDistributed(addresses){
        let form = $('#manageCrowdsale');
        let tableBody = $('#parsedDistributionList tbody', form);

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        for(let i=0; i < addresses.length; i++){
            let address = addresses[i];
            let tr = $('tr[data-address='+address+']', tableBody);
            $('td:last-child', tr).text('...');
            crowdsaleInstance.methods.distributedTo(address).call().then(function(result){
                let distributed = web3.utils.fromWei(result);
                $('td:last-child', tr).text(distributed);
                let amount = Number($('td:nth-child(3)', tr).text());
                if(amount < distributed){
                    tr.addClass('badAmount');
                }
            });
        }
    }

    $('#loadTokenInfo').click(async function(){
        if(tokenContract == null) return;
        printError('');
        let form = $('#manageToken');

        let tokenAddress     = $('input[name=tokenAddress]',form).val();
        let tokenInstance = loadContractInstance(tokenContract, tokenAddress);
        
        tokenInstance.methods.owner().call().then(function(result){
            $('input[name=tokenOwner]',form).val(result);
        });
        tokenInstance.methods.totalSupply().call().then(function(result){
            $('input[name=tokenTotalSupply]',form).val(web3.utils.fromWei(result));
        });
        tokenInstance.methods.currentAirdrop().call().then(function(result){
            $('input[name=airdropNum]',form).val(result);
        });
        tokenInstance.methods.multiplierPercent().call().then(function(result){
            $('input[name=airdropMultiplier]',form).val(result/100);
        });
        tokenInstance.methods.undropped().call().then(function(result){
            $('input[name=airdropUndropped]',form).val(web3.utils.fromWei(result));
        });
        tokenInstance.methods.paused().call().then(function(result){
            $('input[name=tokenPaused]',form).val(result?'yes':'no');
        });
    });

    $('#startAirdrop').click(function(){
        if(tokenContract == null) return;
        printError('');
        let form = $('#manageToken');

        let tokenAddress     = $('input[name=tokenAddress]',form).val();
        let tokenInstance = loadContractInstance(tokenContract, tokenAddress);

        let multiplierPercent = Math.round($('input[name=multiplier]',form).val()*100);
        console.log('Starting airdrop with multiplier '+multiplierPercent);
        tokenInstance.methods.startAirdrop(multiplierPercent).send({
            from: web3.eth.defaultAccount,
        })
        .on('error',function(error){
            console.log('Start airdrop failed: ', error);
            printError(error);
        })
        .on('transactionHash',function(tx){
            console.log('Start airdrop tx published', tx);
        })
        .then(function(receipt){
            $('#loadTokenInfo').click(); 
            return receipt; 
        });
    });
    $('#finishAirdrop').click(function(){
        if(tokenContract == null) return;
        printError('');
        let form = $('#manageToken');

        let tokenAddress  = $('input[name=tokenAddress]',form).val();
        let tokenInstance = loadContractInstance(tokenContract, tokenAddress);

        tokenInstance.methods.finishAirdrop().send({
            from: web3.eth.defaultAccount,
        })
        .on('error',function(error){
            console.log('Finish airdrop failed: ', error);
            printError(error);
        })
        .on('transactionHash',function(tx){
            console.log('Finish airdrop tx published', tx);
        })
        .then(function(receipt){
            $('#loadTokenInfo').click(); 
            return receipt; 
        });
    });
    $('#parseAirdropCSV').click(function(){
        let form = $('#manageToken');
        let addressesText = $('textarea[name=airdropAddresses]', form).val();
        let parsed = new Array();
        let parseLog = $('#airdropLog');
        parseLog.html('');
        addressesText.split('\n').forEach(function(elem, idx){
            let addr = elem.trim();
            if(web3.utils.isAddress(addr)){
                parsed.push(addr);
            }else{
                if(!addr.startsWith('0x') || addr.length != 42){
                    parseLog.append('<div>Line '+(idx+1)+': <i>"'+elem+'"</i> is not an ethereum address</div>')    
                }else{
                    let addrFix = addr.toLowerCase();
                    if(web3.utils.isAddress(addrFix)){
                        parseLog.append('<div>Line '+(idx+1)+': <i>'+addr+'</i> has wrong checksumm</div>')    
                        //parsed.push(addrFix);
                    }else {
                        parseLog.append('<div>Line '+(idx+1)+': <i>'+addr+'</i> has corect format but can not be parsed</div>')    
                    }
                }
            }
        });
        parseLog.append('Correctly parsed: '+parsed.length);
        $('textarea[name=parsedAirdropAddresses]', form).val(JSON.stringify(parsed));
    });
    $('#executeAirdrop').click(function(){
        if(tokenContract == null) return;
        printError('');
        let form = $('#manageToken');

        let tokenAddress     = $('input[name=tokenAddress]',form).val();
        let tokenInstance = loadContractInstance(tokenContract, tokenAddress);

        let sendStart = Number($('input[name=airdropBatchStart]', form).val());
        let sendLimit = Number($('input[name=airdropBatchLimit]', form).val());
        if(Number(sendLimit) <= 0) {
            console.log('Bad send limit: '+sendLimit); return;
        }
        let airdropLog = $('#airdropLog');

        let addresses = JSON.parse($('textarea[name=parsedAirdropAddresses]', form).val());
        if(typeof addresses != 'object' || addresses.length == 0){
            console.error('Can not parse addresses');
            return;
        }
        airdropLog.append('<div>Starting airdrop token distribution to '+addresses.length+' addresses in batches of '+sendLimit+' addresses per transaction, starting from address '+sendStart+'.</div>');
        function sendTokens(start) {
            let end = start+sendLimit;
            if(end > addresses.length) end = addresses.length;
            if(start >= end) {
                console.error('Start >= End!', start, sendLimit, end); return;
            }
            let addressList = addresses.slice(start, start+sendLimit);
            console.log('Airdrop addresses '+start+' - '+end, addressList);
            let tx = null;
            tokenInstance.methods.drop(addressList).send({
                from: web3.eth.defaultAccount,
            })
            .on('transactionHash', function(hash){
                tx = hash;
                airdropLog.append('<div>Transaction <i>'+tx+'</i>: addresses '+start+' - '+end+' published.</div>');
                if(end != addresses.length){
                    sendTokens(end);
                }else{
                    $('#executeAirdrop').attr('disabled', false);
                }
            })
            .on('error', function(error){
                console.log('Error sending to addresses '+start+' - '+end+((tx==null)?'':', tx '+tx), error);
                $('#executeAirdrop').attr('disabled', false);
            })
            .then(function(receipt){
                airdropLog.append('<div>Transaction <i>'+receipt.transactionHash+'</i> ('+start+' - '+end+') mined.</div>');
                $('#loadTokenInfo').click();
                return receipt;
            })
        }
        $('#executeAirdrop').attr('disabled', true);
        sendTokens(sendStart);

    });

    //====================================================

    async function loadWeb3(){
        printError('');
        if(typeof window.web3 == "undefined"){
            printError('No MetaMask found');
            return null;
        }
        let web3 = new Web3(window.web3.currentProvider);

        let accounts = await web3.eth.getAccounts();
        if(typeof accounts[0] == 'undefined'){
            printError('Please, unlock MetaMask');
            return null;
        }
        // web3.eth.getBlock('latest', function(error, result){
        //     console.log('Current latest block: #'+result.number+' '+timestmapToString(result.timestamp), result);
        // });
        web3.eth.defaultAccount =  accounts[0];
        window.web3 = web3;
        return web3;
    }
    function loadContract(url, callback){
        $.ajax(url,{'dataType':'json', 'cache':'false', 'data':{'t':Date.now()}}).done(callback);
    }

    function loadContractInstance(contractDef, address){
        if(typeof contractDef == 'undefined' || contractDef == null) return null;
        if(!web3.utils.isAddress(address)){printError('Contract '+contractDef.contract_name+' address '+address+' is not an Ethereum address'); return null;}
        return new web3.eth.Contract(contractDef.abi, address);
    }

    function timeStringToTimestamp(str){
        return Math.round(Date.parse(str)/1000);
    }
    function timestmapToString(timestamp){
        return (new Date(timestamp*1000)).toISOString();
    }

    /**
    * Take GET parameter from current page URL
    */
    function getUrlParam(name){
        if(window.location.search == '') return null;
        let params = window.location.search.substr(1).split('&').map(function(item){return item.split("=").map(decodeURIComponent);});
        let found = params.find(function(item){return item[0] == name});
        return (typeof found == "undefined")?null:found[1];
    }

    function parseCSV(data){
        data = data.replace(/\t/g, ' ');
        let lineSeparator = '\n';
        let columnSeparator = ' ';
        let csv = data.trim().split(lineSeparator).map(function(line){
            return line.trim().split(columnSeparator).map(function(elem){
                return elem.trim();
            });
        });
        return csv;
    }
    function htmlEntities(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function printError(msg){
        if(msg == null || msg == ''){
            $('#errormsg').html('');    
        }else{
            console.error(msg);
            $('#errormsg').html(msg);
        }
    }
});
