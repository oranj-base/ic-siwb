import React, { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Spin, Typography } from 'antd';
import { useSiwbIdentity } from '../siwb';

export default function ConnectDialog({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (isOpen: boolean) => void }) {
  //   const { connect, connectors, error, isPending, variables, reset } = useConnect();
  //   const { isConnected } = useAccount();
  const { prepareLogin, isPrepareLoginIdle, prepareLoginError, loginError, setWalletProvider, login, getAddress, connectedBtcAddress, identity } =
    useSiwbIdentity();

  const [loading, setLoading] = useState<boolean>(false);
  const [manually, setManually] = useState<boolean>(false);
  /**
   * Preload a Siwb message on every address change.
   */
  useEffect(() => {
    if (!isPrepareLoginIdle) return;
    if (getAddress()) {
      prepareLogin();
      if (connectedBtcAddress && !identity && manually) {
        (async () => {
          setLoading(true);
          const res = await login();
          setLoading(false);
          if (res) {
            setManually(false);
            setIsOpen(false);
          }
        })();
      }
    }
  }, [prepareLogin, isPrepareLoginIdle, getAddress, setIsOpen, login, connectedBtcAddress, identity, manually]);

  /**
   * Show an error toast if the prepareLogin() call fails.
   */
  useEffect(() => {}, [prepareLoginError]);

  /**
   * Show an error toast if the login call fails.
   */
  useEffect(() => {}, [loginError]);

  return (
    <Modal className="relative z-50 w-80" open={isOpen}>
      <Typography.Title> Select Wallet</Typography.Title>
      <Button
        key="wizz"
        onClick={async () => {
          setManually(true);
          await setWalletProvider('wizz');
        }}
        disabled={loading}
      >
        Wizz Wallet
      </Button>
      <Button
        key="unisat"
        onClick={async () => {
          setManually(true);
          await setWalletProvider('unisat');
        }}
        disabled={loading}
      >
        Unisat Wallet
      </Button>
      {loading && <Spin />}
    </Modal>
  );
}
