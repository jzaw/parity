// Copyright 2015, 2016 Ethcore (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

import React, { Component, PropTypes } from 'react';
import ActionDoneAll from 'material-ui/svg-icons/action/done-all';
import ContentClear from 'material-ui/svg-icons/content/clear';

import { BusyStep, CompletedStep, CopyToClipboard, Button, IdentityIcon, Modal, TxHash } from '../../ui';
import { ERRORS, validateAbi, validateCode, validateName } from '../../util/validation';

import DetailsStep from './DetailsStep';
import ParametersStep from './ParametersStep';
import ErrorStep from './ErrorStep';

import styles from './deployContract.css';

import { ERROR_CODES } from '../../api/transport/error';

const STEPS = {
  CONTRACT_DETAILS: { title: 'contract details' },
  CONTRACT_PARAMETERS: { title: 'contract parameters' },
  DEPLOYMENT: { title: 'deployment' },
  COMPLETED: { title: 'completed' }
};

const CONTRACT_INPUT_TYPES = [
  {
    key: 'MANUAL',
    label: 'Manually',
    description: 'Manual input of the ABI and the bytecode'
  },
  {
    key: 'SOLC',
    label: 'From solc',
    description: 'Parse the ABI and the bytecode from solc output'
  }
];

export default class DeployContract extends Component {
  static contextTypes = {
    api: PropTypes.object.isRequired,
    store: PropTypes.object.isRequired
  }

  static propTypes = {
    accounts: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    abi: PropTypes.string,
    code: PropTypes.string,
    readOnly: PropTypes.bool,
    source: PropTypes.string
  };

  static defaultProps = {
    readOnly: false,
    source: ''
  };

  state = {
    abi: '',
    abiError: ERRORS.invalidAbi,
    code: '',
    codeError: ERRORS.invalidCode,
    description: '',
    descriptionError: null,
    fromAddress: Object.keys(this.props.accounts)[0],
    fromAddressError: null,
    name: '',
    nameError: ERRORS.invalidName,
    params: [],
    paramsError: [],
    inputType: CONTRACT_INPUT_TYPES[0],

    deployState: '',
    deployError: null,
    rejected: false,
    step: 'CONTRACT_DETAILS'
  }

  componentWillMount () {
    const { abi, code } = this.props;

    if (abi && code) {
      this.setState({ abi, code });
    }
  }

  componentWillReceiveProps (nextProps) {
    const { abi, code } = nextProps;
    const newState = {};

    if (abi !== this.props.abi) {
      newState.abi = abi;
    }

    if (code !== this.props.code) {
      newState.code = code;
    }

    if (Object.keys(newState).length) {
      this.setState(newState);
    }
  }

  render () {
    const { step, deployError, rejected } = this.state;

    const realStep = Object.keys(STEPS).findIndex((k) => k === step);
    const realSteps = deployError || rejected
      ? null
      : Object.values(STEPS).map((s) => s.title);

    const title = realSteps
      ? null
      : (deployError ? 'deployment failed' : 'rejected');

    return (
      <Modal
        actions={ this.renderDialogActions() }
        current={ realStep }
        steps={ realSteps }
        title={ title }
        waiting={ realSteps ? [2] : null }
        visible
        scroll>
        { this.renderStep() }
      </Modal>
    );
  }

  renderDialogActions () {
    const { deployError, abiError, codeError, nameError, descriptionError, fromAddressError, fromAddress, step } = this.state;
    const isDetailsValid = !nameError && !fromAddressError && !descriptionError;
    const isParametersValid = !abiError && !codeError;

    const cancelBtn = (
      <Button
        icon={ <ContentClear /> }
        label='Cancel'
        onClick={ this.onClose } />
    );

    const closeBtn = (
      <Button
        icon={ <ContentClear /> }
        label='Close'
        onClick={ this.onClose } />
    );

    const closeBtnOk = (
      <Button
        icon={ <ActionDoneAll /> }
        label='Close'
        onClick={ this.onClose } />
    );

    if (deployError) {
      return closeBtn;
    }

    switch (step) {
      case 'CONTRACT_DETAILS':
        return [
          cancelBtn,
          <Button
            disabled={ !isDetailsValid }
            icon={ <IdentityIcon button address={ fromAddress } /> }
            label='Next'
            onClick={ this.onParametersStep } />
        ];

      case 'CONTRACT_PARAMETERS':
        return [
          cancelBtn,
          <Button
            disabled={ !isParametersValid }
            icon={ <IdentityIcon button address={ fromAddress } /> }
            label='Create'
            onClick={ this.onDeployStart } />
        ];

      case 'DEPLOYMENT':
        return [ closeBtn ];

      case 'COMPLETED':
        return [ closeBtnOk ];
    }
  }

  renderStep () {
    const { accounts, readOnly } = this.props;
    const { address, deployError, step, deployState, txhash, rejected } = this.state;

    if (deployError) {
      return (
        <ErrorStep error={ deployError } />
      );
    }

    if (rejected) {
      return (
        <BusyStep
          title='The deployment has been rejected'
          state='You can safely close this window, the contract deployment will not occur.'
        />
      );
    }

    switch (step) {
      case 'CONTRACT_DETAILS':
        return (
          <DetailsStep
            { ...this.state }
            accounts={ accounts }
            readOnly={ readOnly }
            inputTypeValues={ CONTRACT_INPUT_TYPES }
            onFromAddressChange={ this.onFromAddressChange }
            onDescriptionChange={ this.onDescriptionChange }
            onNameChange={ this.onNameChange }
            onInputTypeChange={ this.onInputTypeChange }
          />
        );

      case 'CONTRACT_PARAMETERS':
        return (
          <ParametersStep
            { ...this.state }
            readOnly={ readOnly }
            accounts={ accounts }
            onAbiChange={ this.onAbiChange }
            onCodeChange={ this.onCodeChange }
            onParamsChange={ this.onParamsChange }
          />
        );

      case 'DEPLOYMENT':
        const body = txhash
          ? <TxHash hash={ txhash } />
          : null;
        return (
          <BusyStep
            title='The deployment is currently in progress'
            state={ deployState }>
            { body }
          </BusyStep>
        );

      case 'COMPLETED':
        return (
          <CompletedStep>
            <div>Your contract has been deployed at</div>
            <div>
              <CopyToClipboard data={ address } label='copy address to clipboard' />
              <IdentityIcon address={ address } inline center className={ styles.identityicon } />
              <div className={ styles.address }>{ address }</div>
            </div>
            <TxHash hash={ txhash } />
          </CompletedStep>
        );
    }
  }

  onParametersStep = () => {
    this.setState({ step: 'CONTRACT_PARAMETERS' });
  }

  onDescriptionChange = (description) => {
    this.setState({ description, descriptionError: null });
  }

  onInputTypeChange = (inputType) => {
    this.setState({ inputType });
  }

  onFromAddressChange = (fromAddress) => {
    const { api } = this.context;

    const fromAddressError = api.util.isAddressValid(fromAddress)
      ? null
      : 'a valid account as the contract owner needs to be selected';

    this.setState({ fromAddress, fromAddressError });
  }

  onNameChange = (name) => {
    this.setState(validateName(name));
  }

  onParamsChange = (params) => {
    this.setState({ params });
  }

  onAbiChange = (abi) => {
    const { api } = this.context;

    this.setState(validateAbi(abi, api));
  }

  onCodeChange = (code) => {
    const { api } = this.context;

    this.setState(validateCode(code, api));
  }

  onDeployStart = () => {
    const { api, store } = this.context;
    const { source } = this.props;
    const { abiParsed, code, description, name, params, fromAddress } = this.state;
    const options = {
      data: code,
      from: fromAddress
    };

    this.setState({ step: 'DEPLOYMENT' });

    api
      .newContract(abiParsed)
      .deploy(options, params, this.onDeploymentState)
      .then((address) => {
        return Promise.all([
          api.parity.setAccountName(address, name),
          api.parity.setAccountMeta(address, {
            abi: abiParsed,
            contract: true,
            timestamp: Date.now(),
            deleted: false,
            source,
            description
          })
        ])
        .then(() => {
          console.log(`contract deployed at ${address}`);
          this.setState({ step: 'DEPLOYMENT', address });
        });
      })
      .catch((error) => {
        if (error.code === ERROR_CODES.REQUEST_REJECTED) {
          this.setState({ rejected: true });
          return false;
        }

        console.error('error deploying contract', error);
        this.setState({ deployError: error });
        store.dispatch({ type: 'newError', error });
      });
  }

  onDeploymentState = (error, data) => {
    if (error) {
      console.error('onDeploymentState', error);
      return;
    }

    switch (data.state) {
      case 'estimateGas':
      case 'postTransaction':
        this.setState({ deployState: 'Preparing transaction for network transmission' });
        return;

      case 'checkRequest':
        this.setState({ deployState: 'Waiting for confirmation of the transaction in the Parity Secure Signer' });
        return;

      case 'getTransactionReceipt':
        this.setState({ deployState: 'Waiting for the contract deployment transaction receipt', txhash: data.txhash });
        return;

      case 'hasReceipt':
      case 'getCode':
        this.setState({ deployState: 'Validating the deployed contract code' });
        return;

      case 'completed':
        this.setState({ deployState: 'The contract deployment has been completed' });
        return;

      default:
        console.error('Unknow contract deployment state', data);
        return;
    }
  }

  onClose = () => {
    this.props.onClose();
  }
}
