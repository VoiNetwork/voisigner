import { FunctionalComponent } from 'preact';
import { html } from 'htm/preact';
import { useState, useContext, useEffect, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import { JsonRpcMethod } from '@algosigner/common/messaging/types';
import { Namespace } from '@algosigner/common/types';
import { obsfucateAddress } from '@algosigner/common/utils';

import { StoreContext } from 'services/StoreContext';
import { sendMessage } from 'services/Messaging';
import { assetFormat, numFormat } from 'services/common';

import HeaderView from 'components/HeaderView';
import Authenticate from 'components/Authenticate';
import ContactPreview from 'components/ContactPreview';

import algosdk from 'algosdk';

const ALIAS_TIMER = 500;
const MAX_LENGTH_LOOKUP = 20;

const SendAlgos: FunctionalComponent = (props: any) => {
  const store: any = useContext(StoreContext);
  const { matches, ledger, address } = props;
  const inputRef = useRef<HTMLHeadingElement>(null);

  const [, forceUpdate] = useState<boolean>(false);
  const [account, setAccount] = useState<any>({});
  const [askAuth, setAskAuth] = useState<boolean>(false);
  const [ddActive, setDdActive] = useState<boolean>(false);
  // Asset {} is Algos
  const [asset, setAsset] = useState<any>({});
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [txId, setTxId] = useState('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchTimerID, setSearchTimerID] = useState<NodeJS.Timeout | undefined>(undefined);
  const [aliases, setAliases] = useState<any>({});
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [addingContact, setAddingContact] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Initial setup
  useEffect(() => {
    for (let i = store[ledger].length - 1; i >= 0; i--) {
      if (store[ledger][i].address === address) {
        setAccount(store[ledger][i]);
        break;
      }
    }
  }, []);
  useEffect(() => {
    if (inputRef !== null && inputRef.current !== null) {
      inputRef.current.focus();
    }
  }, [selectedDestination]);

  // Transaction signing
  const selectAsset = (selectedAsset) => {
    setDdActive(false);

    // Load details if they are not present in the session or is an empty object (algos).
    if (Object.keys(selectedAsset).length === 0 || 'decimals' in selectedAsset) {
      setAsset(selectedAsset);
      handleAmountChange(amount, selectedAsset);
    } else {
      const params = {
        'ledger': ledger,
        'asset-id': selectedAsset['asset-id'],
      };

      sendMessage(JsonRpcMethod.AssetDetails, params, function (response) {
        const keys = Object.keys(response.asset.params);
        for (let i = keys.length - 1; i >= 0; i--) {
          selectedAsset[keys[i]] = response.asset.params[keys[i]];
        }
        setAsset(selectedAsset);
        handleAmountChange(amount, selectedAsset);
      });
    }
  };
  const sendTx = async (pwd: string) => {
    setLoading(true);
    setAuthError('');
    setError('');

    // We convert from String to BigInt while mantaining decimals.
    const decimals = 'decimals' in asset ? asset.decimals : 6;
    const amountArray = amount.split('.');
    const decimalsOnTheInput = amountArray.length > 1;
    let amountToSend = BigInt(amountArray[0]) * BigInt(Math.pow(10, decimals));
    if (decimalsOnTheInput) {
      amountToSend +=
        BigInt(amountArray[1]) * BigInt(Math.pow(10, decimals - amountArray[1].length));
    }

    const params: any = {
      ledger: ledger,
      passphrase: pwd,
      address: account.address,
      txnParams: {
        from: account.address,
        to: to || (selectedDestination && selectedDestination.address),
        note: note,
        amount: amountToSend,
      },
    };

    if ('asset-id' in asset) {
      params.txnParams.type = 'axfer';
      params.txnParams.assetIndex = asset['asset-id'];
    } else {
      params.txnParams.type = 'pay';
    }

    sendMessage(JsonRpcMethod.SignSendTransaction, params, function (response) {
      setLoading(false);
      if ('error' in response) {
        switch (response.error) {
          case 'Login Failed':
            setAuthError('Wrong passphrase');
            break;
          default:
            setError(response.error);
            setAskAuth(false);
            break;
        }
      } else {
        setAskAuth(false);
        setTxId(response.txId);
      }
    });
  };
  const saveContact = () => {
    const params = {
      name: newContactName,
      address: to,
    };
    setLoading(true);
    setError('');
    sendMessage(JsonRpcMethod.SaveContact, params, function (response) {
      setLoading(false);
      if ('error' in response) {
        setError(response.error.message);
      } else {
        goBack();
      }
    });
  };

  // Domains search and handling
  const searchAliases = async (searchTerm) => {
    console.log(`Searching for ${searchTerm}`);
    const params = { ledger: ledger, searchTerm: searchTerm };
    sendMessage(JsonRpcMethod.GetAliasedAddresses, params, (response) => {
      console.log(response);
      setLoading(false);
      if ('error' in response) {
        setError(response.error.message);
      } else {
        setAliases(response);
      }
    });
  };
  const handleTimeout = async (searchTerm) => {
    console.log(`executing alias lookup for ${searchTerm}`);
    clearTimeout(searchTimerID as NodeJS.Timeout);
    setSearchTimerID(undefined);
    await searchAliases(searchTerm);
  };
  const handleAddressChange = (value) => {
    console.log(`setting term to ${value} and queueing lookup`);
    clearTimeout(searchTimerID as NodeJS.Timeout);
    setAliases({});
    setTo(value);
    if (value.length && value.length <= MAX_LENGTH_LOOKUP) {
      setSearchTerm(value);
      setSearchTimerID(setTimeout(() => handleTimeout(value), ALIAS_TIMER));
    } else {
      setSearchTerm('');
    }
  };

  // Destination (de)selection
  const onSelectDestination = (c) => {
    setSelectedDestination(c);
    setTo('');
  };
  const editDestination = () => {
    setTo(searchTerm);
    setSelectedDestination(null);
  };

  // Other UI functions and variables
  const goBack = () => {
    route(`/${matches.ledger}/${matches.address}`);
  };
  const handleAmountChange = (val, ass) => {
    const decimals = 'decimals' in ass ? ass.decimals : 6;
    const integer = decimals >= 16 ? 1 : 16 - decimals;
    let regex;
    if (decimals > 0) regex = new RegExp(`\\d{1,${integer}}(\\.\\d{0,${decimals}})?`);
    else regex = new RegExp(`\\d{1,16}`);

    const finalVal = val.match(regex);
    if (finalVal) setAmount(finalVal[0]);
    else setAmount('');
    forceUpdate((n) => !n);
  };

  let ddClass: string = 'dropdown is-right';
  if (ddActive) ddClass += ' is-active';
  const youIndicator = html`<b class="has-text-link">YOU</b>`;
  const disabled = (!selectedDestination && !algosdk.isValidAddress(to)) || +amount < 0;

  // Render HTML
  return html`
    <div class="main-view" style="flex-direction: column; justify-content: space-between;">
      <${HeaderView}
        action="${() => route(`/${matches.ledger}/${matches.address}`)}"
        title="Send"
      />

      <div class="px-4" style="flex: 1">
        <div class="is-flex mb-2" style="justify-content: space-between;">
          <div class="control">
            <input
              class="input"
              id="transferAmount"
              placeholder="0.000"
              style="width: 245px;"
              value=${amount}
              onInput=${(e) => handleAmountChange(e.target.value, asset)}
            />
            ${'decimals' in asset &&
            html`
              <p class="has-text-grey has-text-centered mt-1" style="font-size: 0.9em;">
                This asset allows for
                <span> ${asset.decimals} decimal${asset.decimals !== 1 && 's'}</span>
              </p>
            `}
          </div>
          <div class=${ddClass}>
            <div class="dropdown-trigger">
              <button
                id="selectAsset"
                class="button pr-1 pl-0"
                onClick=${() => setDdActive(!ddActive)}
                aria-haspopup="true"
                aria-controls="dropdown-menu"
                style="border: none; width: 120px; justify-content: flex-end;"
              >
                <span style="text-overflow: ellipsis; overflow: hidden;">
                  ${asset['unit-name'] || asset['name'] || asset['asset-id'] || 'Algos'}
                </span>
                <span class="icon is-small">
                  <i class="fas fa-caret-down" aria-hidden="true"></i>
                </span>
              </button>
            </div>
            <div class="dropdown-menu" id="dropdown-menu" role="menu">
              <div class="dropdown-content" style="max-height: 330px; overflow: auto;">
                <a
                  id="asset-0"
                  onClick=${() => selectAsset({})}
                  class="dropdown-item is-flex px-4"
                  style="justify-content: space-between;"
                >
                  <span>Algos</span>
                  <span class="ml-4 has-text-grey">
                    ${account.details && numFormat(account.details.amount / 1e6, 6)} Algos
                  </span>
                </a>
                ${account.details &&
                account.details.assets.map(
                  (x) => html`
                    <a
                      id=${`asset-${x['asset-id']}`}
                      title=${x['asset-id']}
                      onClick=${() => selectAsset(x)}
                      class="dropdown-item is-flex px-4"
                      style="justify-content: space-between;"
                    >
                      <span>${x['name'] || x['asset-id']}</span>
                      <span class="ml-4 has-text-grey">
                        ${assetFormat(x.amount, x.decimals)} ${x['unit-name']}
                      </span>
                    </a>
                  `
                )}
              </div>
            </div>
          </div>
        </div>

        <div class="mb-2"><b>From</b></div>
        ${account.details &&
        html`<${ContactPreview} contact="${account}" rightSide=${youIndicator} />`}

        <div class="has-text-centered has-text-weight-bold my-2">
          <span><i class="fas fa-arrow-down mr-3"></i></span>
          ${'asset-id' in asset && html` <span>Asset transfer</span> `}
          ${!('asset-id' in asset) && html` <span>Payment</span> `}
        </div>

        <div>
          ${!selectedDestination &&
          html`
            <textarea
              placeholder="Destination can be one of: an address, an imported account, an added contact"
              class="textarea has-fixed-size mb-4 pr-6"
              id="toAddress"
              value=${to}
              ref=${inputRef}
              rows="2"
              onInput=${(e) => handleAddressChange(e.target.value)}
            />
            ${searchTerm &&
            html`
              ${!Object.keys(aliases).length &&
              html`<span style="position: absolute; left: 90%; bottom: 43%;" class="loader" />`}
              ${Object.keys(aliases).length > 0 &&
              html`
                <div
                  class="alias-selector"
                >
                  ${Object.keys(Namespace).map((n) =>
                    aliases[n].map(
                      (a) =>
                        html`
                          <a
                            onClick=${() => onSelectDestination(a)}
                            class="dropdown-item is-flex px-4"
                            style="justify-content: space-between;"
                          >
                            <span style="text-overflow: ellipsis; overflow: hidden;">
                              ${a.name}
                            </span>
                            <span class="ml-2 has-text-grey has-text-right is-flex-grow-1">
                              ${obsfucateAddress(a.address)}
                            </span>
                          </a>
                        `
                    )
                  )}
                </div>
              `}
            `}
          `}
          ${selectedDestination &&
          html`
            <i
              class="far fa-edit px-1"
              style="position: relative; z-index: 3; top: 7px; left: 92%; cursor: pointer;"
              aria-label="edit"
              onClick=${() => editDestination()}
            ></i>
            <${ContactPreview}
              contact="${selectedDestination}"
              style="margin-top: -22px;"
              className="mb-4"
            />
          `}
        </div>
        <textarea
          placeholder="Note"
          class="textarea has-fixed-size mb-4"
          style="resize: none;"
          id="note"
          value=${note}
          rows="2"
          onInput=${(e) => setNote(e.target.value)}
        />
      </div>
      <div class="px-4 py-4">
        <button
          id="submitTransfer"
          class="button is-primary is-fullwidth"
          disabled=${disabled}
          onClick=${() => setAskAuth(true)}
        >
          Send!
        </button>
      </div>
    </div>

    ${askAuth &&
    html`
      <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-content">
          <${Authenticate} error=${authError} loading=${loading} nextStep=${sendTx} />
        </div>
        <button
          class="modal-close is-large"
          aria-label="close"
          onClick=${() => setAskAuth(false)}
        />
      </div>
    `}
    ${txId.length > 0 &&
    html`
      <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-content">
          <div class="box">
            <p>Transaction sent with ID:</p>
            <p id="txId" class="mb-4" style="word-break: break-all;">${txId}</p>
            ${!selectedDestination &&
            !aliases.find((a) => a.address === to) &&
            html`
              <p>This address is not on your contact list, would you like to save it?</p>
              ${addingContact &&
              html`
                <div class="is-flex mt-2">
                  <input
                    class="input mr-2"
                    id="newContactName"
                    placeholder="Contact name"
                    value=${newContactName}
                    onInput=${(e) => setNewContactName(e.target.value)}
                  />
                  <button
                    id="confirmNewContact"
                    disabled=${loading}
                    class="button is-success ${loading ? 'is-loading' : ''}"
                    onClick=${() => saveContact()}
                  >
                    Save
                  </button>
                </div>
              `}
              ${!addingContact &&
              html`
                <button
                  id="saveNewContact"
                  class="button is-primary is-fullwidth"
                  onClick=${() => setAddingContact(true)}
                >
                  Save new Contact
                </button>
              `}
            `}
            <button
              id="backToAccount"
              class="button is-primary is-fullwidth mt-2"
              onClick=${() => goBack()}
            >
              Back to account!
            </button>
          </div>
        </div>
      </div>
    `}
    ${error !== undefined &&
    error.length > 0 &&
    html`
      <div class="modal is-active">
        <div class="modal-background"></div>
        <div class="modal-content">
          <div class="box">
            <p class="has-text-danger has-text-weight-bold mb-2">
              Transaction failed with the following error:
            </p>
            <p id="tx-error">${error}</p>
          </div>
        </div>
        <button class="modal-close is-large" aria-label="close" onClick=${() => setError('')} />
      </div>
    `}
  `;
};

export default SendAlgos;
