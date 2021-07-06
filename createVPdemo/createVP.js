const {
    transactionFactory,
    UserIdentity,
    tokensFactory
} = require('alastria-identity-lib')
const fs = require('fs')
const keythereum = require('keythereum')

const rawdata = fs.readFileSync('../configuration.json')
const configData = JSON.parse(rawdata)

const presentationRawData = fs.readFileSync('./mockPresentation.json')
const presentationData = JSON.parse(presentationRawData)

const keyDataHolder = fs.readFileSync(
    '../keystores/holderData.json'
)
const keystoreDataHolder = JSON.parse(keyDataHolder)

const Web3 = require('web3')
const myBlockchainServiceIp = configData.nodeURL
const web3 = new Web3(new Web3.providers.HttpProvider(myBlockchainServiceIp))

const uri = configData.uri

const holderKeystore = keystoreDataHolder

let subject1PrivateKey
try {
    holderPrivateKey = keythereum.recover(
        configData.addressHolderPassword,
        holderKeystore
    )
} catch (error) {
    console.log('ERROR: ', error)
}

const holderIdentity = new UserIdentity(
    web3,
    `0x${holderKeystore.address}`,
    holderPrivateKey
)


const createPresentation = tokensFactory.tokens.createPresentation(
    presentationData.credentials[0].payload.iss,
    presentationData.credentials[0].payload.aud,
    presentationData.credentials[0].payload.vp['@context'],
    presentationData.credentials[0].payload.vp.verifiableCredential,
    presentationData.credentials[0].payload.vp.procUrl,
    presentationData.credentials[0].payload.vp.procHash,
    presentationData.credentials[0].payload.vp.type,
    presentationData.credentials[0].header.kid,
    presentationData.credentials[0].header.jwk,
    presentationData.credentials[0].payload.exp,
    presentationData.credentials[0].payload.nbf,
    presentationData.credentials[0].payload.jti
)
console.log('createPresentation ---------->', createPresentation)

const signedJWTPresentation = tokensFactory.tokens.signJWT(
    createPresentation,
    holderPrivateKey
)
console.log('signedJWTPresentation ------------->', signedJWTPresentation)

const holderPresentationHash = tokensFactory.tokens.PSMHash(
    web3,
    signedJWTPresentation,
    configData.didSubjectHolder
)
console.log('The PSMHashHolder is:', holderPresentationHash)
fs.writeFileSync(
    `./PSMHashHolder.json`,
    JSON.stringify({
        psmhash: holderPresentationHash,
        jwt: signedJWTPresentation
    })
)

const receiverPresentationHash = tokensFactory.tokens.PSMHash(
    web3,
    signedJWTPresentation,
    configData.didEntityProvider
)
console.log('The PSMHashEntityProvider is:', receiverPresentationHash)
fs.writeFileSync(
    `./PSMHashProvider.json`,
    JSON.stringify({
        psmhash: receiverPresentationHash,
        jwt: signedJWTPresentation
    })
)

const addPresentationTransaction = transactionFactory.presentationRegistry.addSubjectPresentation(
    web3,
    holderPresentationHash,
    uri
)

async function main() {
    const holderPresentationSigned = await holderIdentity.getKnownTransaction(
        addPresentationTransaction
    )
    console.log(
        '(holderPresentationSigned)The transaction bytes data is: ',
        holderPresentationSigned
    )
    web3.eth
        .sendSignedTransaction(holderPresentationSigned)
        .on('hash', (txHash) => {
            console.log('txHash ---------->', txHash)
        })
        .on('receipt', (receipt) => {
            console.log('Receipt --------->', receipt)
        })
        .on('error', (error) => {
            console.log('ERROR ---------->', error)
        })
}

main()
