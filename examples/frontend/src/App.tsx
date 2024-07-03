import React from 'react';

import icLogo from './assets/ic.svg';
import btcLogo from './assets/btc.svg';
import './App.css';
import { useSiwbIdentity } from './siwb';
import { Button, Typography } from 'antd';

// import { useSiwbIdentity } from 'ic-use-siwb-identity'

function App() {
  const { identity, identityAddress, clear } = useSiwbIdentity();

  return (
    <>
      <div>
        <a href="https://internetcomputer.org" target="_blank">
          <img src={icLogo} className="logo" alt="IC logo" />
        </a>
        <a href="https://bitcoin.org" target="_blank">
          <img src={btcLogo} className="logo btc" alt="BTC logo" />
        </a>
      </div>
      <h1>IC x BTC </h1>
      <div className="card">
        <Typography.Title level={5} style={{ color: '#fff' }}>
          BTC Address is
        </Typography.Title>
        <Typography.Text style={{ color: '#fff' }}>{identityAddress}</Typography.Text>
      </div>
      <div className="card">
        <Typography.Title level={5} style={{ color: '#fff' }}>
          Identity Principal is
        </Typography.Title>
        <Typography.Text style={{ color: '#fff' }}>{identity?.getPrincipal().toText()}</Typography.Text>
      </div>
      <Button
        type="dashed"
        onClick={() => {
          clear();
        }}
      >
        Click here to try again
      </Button>
    </>
  );
}

export default App;
