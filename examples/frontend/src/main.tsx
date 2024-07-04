import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import AuthGuard from './AuthGuard.tsx';
import './index.css';
// import { SiwbIdentityProvider } from 'ic-use-siwb-identity';
import type { _SERVICE as siweService } from './idls/ic_siwb_provider.d.ts';
import { idlFactory as siwbIdl } from './idls/ic_siwb_provider.idl.ts';
import { SiwbIdentityProvider } from 'ic-use-siwb-identity';

ReactDOM.createRoot(document.getElementById('root')!).render(
  //<React.StrictMode>
  <SiwbIdentityProvider<siweService>
    canisterId="bw4dl-smaaa-aaaaa-qaacq-cai"
    idlFactory={siwbIdl}
    httpAgentOptions={{ host: 'http://127.0.0.1:8080' }}
  >
    <AuthGuard>
      <App />
    </AuthGuard>
  </SiwbIdentityProvider>,
  // </React.StrictMode>,
);
