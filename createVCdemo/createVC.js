const {
    transactionFactory,
    UserIdentity,
    tokensFactory
  } = require('alastria-identity-lib')
  const Web3 = require('web3')
  const fs = require('fs')
  const keythereum = require('keythereum')
  
  const rawdata = fs.readFileSync('../configuration.json')
  const configData = JSON.parse(rawdata)
  
  const keyDataIssuer = fs.readFileSync(
    '../keystores/issuerData.json'
  )
  const keystoreDataIssuer = JSON.parse(keyDataIssuer)
  const keyDataHolder = fs.readFileSync(
    '../keystores/holderData.json'
  )
  const keystoreDataHolder = JSON.parse(keyDataHolder)
  
  // Init your blockchain provider
  const myBlockchainServiceIp = configData.nodeURL
  const web3 = new Web3(new Web3.providers.HttpProvider(myBlockchainServiceIp))
  // ------------------------------------------------------------------------------
  console.log('\n ------ Preparing Holder identity ------ \n')
  
  // Some fake data to test
  
  const issuerKeyStore = keystoreDataIssuer
  
  let issuerPrivateKey
  try {
    issuerPrivateKey = keythereum.recover(
      configData.addressIssuerPassword,
      issuerKeyStore
    )
  } catch (error) {
    console.log('ERROR: ', error)
  }
  
  const holderKeyStore = keystoreDataHolder
  
  let holderPrivateKey
  try {
    holderPrivateKey = keythereum.recover(
      configData.addressHolderPassword,
      holderKeyStore
    )
  } catch (error) {
    console.log('ERROR: ', error)
  }
  
  const holderIdentity = new UserIdentity(
    web3,
    `0x${holderKeyStore.address}`,
    holderPrivateKey
  )
  
  console.log('\n ------ Creating credential ------ \n')
  
  const jti = configData.jti
  const kidCredential = configData.kidCredential
  const subjectAlastriaID = configData.subjectAlastriaID
  const didIssuer = configData.didEntityIssuer
  const didSubjectHolder = configData.didSubjectHolder
  const context = configData.context
  const tokenExpTime = configData.tokenExpTime
  const tokenActivationDate = configData.tokenActivationDate
  
  // Credential Map (key-->value)
  const credentialSubject = {}
  const credentialKey = configData.credentialKey
  const credentialValue = configData.credentialValue
  credentialSubject[credentialKey] = credentialValue
  const levelOfAssuranceBasic = 1
  credentialSubject.levelOfAssurance = levelOfAssuranceBasic

  const jwk = configData.subjectHolderPubk
  credentialSubject.jwk=jwk
  const type = ['GoldLuckSymbol']
  credentialSubject.type = type
  const proof = {}
  
  proof.type = 'AnonCredDerivedCredentialv1'
  proof.primaryProof= 'cg7wLNSi48K5qNyAVMwdYqVHSMv1Ur8i...Fg2ZvWF6zGvcSAsym2sgSk737'
  proof.nonRevocationProof= 'mu6fg24MfJPU1HvSXsf3ybzKARib4WxG...RSce53M6UwQCxYshCuS3d2h'
  
  credentialSubject.proof = proof

  const uri = configData.uri
  
  // End fake data to test
  
  const credential = tokensFactory.tokens.createCredential(
    didIssuer,
    context,
    credentialSubject,
    kidCredential,
    subjectAlastriaID,
    tokenExpTime,
    tokenActivationDate,
    jti,
    jwk,
    type
  )
  console.log('The credential1 is: ', credential)
  
  const signedJWTCredential = tokensFactory.tokens.signJWT(
    credential,
    issuerPrivateKey
  )
  console.log('The signed token is: ', signedJWTCredential)
  
  const holderCredentialHash = tokensFactory.tokens.PSMHash(
    web3,
    signedJWTCredential,
    didSubjectHolder
  )
  console.log('The Holder PSMHash is ', holderCredentialHash)
  fs.writeFileSync(
    `./PSMHashHolder.json`,
    JSON.stringify({ psmhash: holderCredentialHash, jwt: signedJWTCredential })
  )
  
  function addSubjectCredential() {
    const holderCredential = transactionFactory.credentialRegistry.addSubjectCredential(
      web3,
      holderCredentialHash,
      uri
    )
    console.log('(addSubjectCredential)The transaction is: ', holderCredential)
    return holderCredential
  }
  
  function sendSigned(holderCredentialSigned) {
    return new Promise((resolve, reject) => {
      // web3 default subject address
      web3.eth
        .sendSignedTransaction(holderCredentialSigned)
        .on('transactionHash', function (hash) {
          console.log('HASH: ', hash)
        })
        .on('receipt', (receipt) => {
          resolve(receipt)
        })
        .on('error', (error) => {
          console.log('Error------>', error)
          reject(error)
        })
    })
  }
  
  async function main() {
    const resultHolderCredential = await addSubjectCredential()
  
    const holderCredentialSigned = await holderIdentity.getKnownTransaction(
      resultHolderCredential
    )
    console.log(
      '(addHolderCredential)The transaction bytes data is: ',
      holderCredentialSigned
    )
    sendSigned(holderCredentialSigned).then((receipt) => {
      console.log('RECEIPT:', receipt)
      const holderCredentialTransaction = transactionFactory.credentialRegistry.getSubjectCredentialStatus(
        web3,
        configData.didSubjectHolder,
        holderCredentialHash
      )
      web3.eth
        .call(holderCredentialTransaction)
        .then((HolderCredentialStatus) => {
          const result = web3.eth.abi.decodeParameters(
            ['bool', 'uint8'],
            HolderCredentialStatus
          )
          const credentialStatus = {
            exists: result[0],
            status: result[1]
          }
          console.log('(SubjectHolderCredentialStatus) -----> ', credentialStatus)
        })
    })
  }
  main()
  