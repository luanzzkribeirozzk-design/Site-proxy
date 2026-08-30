# Publicação na Vercel

## Repositório

O painel está no repositório privado `luanzzkribeirozzk-design/replayx-v2-control-panel`.

## Importação

Na Vercel, use **Add New Project**, importe o repositório privado e mantenha o comando de build `pnpm build`. O arquivo `vercel.json` já define a função serverless Express e os rewrites.

## Variáveis de ambiente

Configure as variáveis nos ambientes **Production** e **Preview**:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço, inserido como segredo. Nunca coloque no GitHub, no frontend ou na IPA.
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

A configuração `VITE_*` é usada somente para identificar o aplicativo Web. A credencial administrativa é usada somente no servidor.

## Depois da publicação

Teste `https://SEU-DOMINIO/api/catalog/manifest`. A resposta esperada é JSON com `schemaVersion`, `catalogVersion`, `items`, `notification` e `contentHash`. Não publique regras do Firestore como `allow read, write: if true`; elas devem continuar fechadas enquanto as operações administrativas passarem pelo servidor.

## Limitações de custo e escopo

Não ative o plano Blaze, não adicione cartão e não habilite uploads binários remotos sem confirmar a cota gratuita. O painel atual administra metadados neutros e não distribui nem ativa modificações de jogos. A IPA V2 analisada não deve ser conectada ao painel antes de uma reconstrução segura sem exploit de kernel, escape de sandbox e APIs privadas.
