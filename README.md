# ![AlgoSigner](media/algosigner-wallet-banner-3.png)

An open-source, security audited, Algorand wallet browser extension that lets users approve and sign transactions that are generated by Algorand dApp applications — available for Chrome.

## Chrome Extension Store

The extension is available on the [Chrome Extension Store](https://chrome.google.com/webstore/detail/algosigner/kmmolakhbgdlpkjkcjkebenjheonagdm)

_This is the preferred solution for end-users, updates will be automatically installed after review by the extension store_

Developers working with dApps may also install directly from the release package, or by downloading the project and building it.

## 1.10.0 Release

### Main updates
As part of the process of supporting the [Algorand Foundations ARCs](https://arc.algorand.foundation/), in 1.10.0 a number of non-breaking additions have been made to support how dApps will work with AlgoSigner. In time, the existing legacy features will be deprecated. 

- A new top level object, `window.algorand` is made available and can be accessed by the dapp to make calls to AlgoSigner. The existing `window.AlgoSigner` object remains but will be deprecated over the next year. 
- An updated connection flow and address discovery process for dApps is in place, using `algorand.enable()`. **The existing connection flow persists but will be deprecated over the next 3-6 months.**
- Dapps may also now request for AlgoSigner to directly post signed transactions to the network and not return the signed blob to the dApp for handling. 
- Additional documentation regarding the use of `authAddr` for signing transactions with rekeyed accounts.

## New Users

- Watch [Getting Started with AlgoSigner](https://youtu.be/tG-xzG8r770)
- [Using a Ledger device](docs/ledger.md)
- [Adding Custom Networks](docs/add-network.md) (such as BetaNet or a private network)
- [Troubleshooting Connection issues](docs/connection-issues.md)

## dApp Developers

For teams looking to integrate AlgoSigner into a project:

- [dApp Development guide](docs/dApp-guide.md)
- [AlgoSigner dApp Integration Guide](docs/dApp-integration.md)

**NOTE:** `AlgoSigner.sign()` and `AlgoSigner.signMultisig()` have been officially deprecated. An interactive transition guide is available [here](https://purestake.github.io/algosigner-dapp-example/v1v2TransitionGuide.html) if you still need to migrate existing functionalities.


## AlgoSigner development

For developers interested in working with AlgoSigner, an [Extension Development Guide](docs/extension-developers.md) is available.
Pull requests we accept need to be narrow in scope and all contributors need to sign (once) our [CLA](https://github.com/PureStake/algosigner-cla/blob/main/CLA.md) after submitting one in order for it to be considered.

## License

This project is under the MIT License
