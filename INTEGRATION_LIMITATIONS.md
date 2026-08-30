# Limitações de integração com a IPA V2 atual

O painel online deste projeto administra um catálogo neutro de itens, com seis registros iniciais, nomes, estados, disponibilidade, ordem, histórico, publicações e mensagens. O manifesto público é somente de leitura e não contém credenciais administrativas.

A IPA V2 analisada contém código experimental relacionado a exploit de kernel, escape de sandbox, enumeração de containers e APIs privadas. Por esse motivo, o painel não distribui arquivos binários nem se conecta a rotinas de aplicação de modificações nessa IPA. Integrar sincronização remota a esse binário poderia facilitar a distribuição de componentes inseguros e não é uma base adequada para um aplicativo compartilhável.

Para uma integração legítima no futuro, a IPA deverá ser reconstruída com APIs públicas da Apple, identificador de bundle próprio, permissões mínimas e um fluxo de dados autorizado. Depois dessa revisão, o cliente poderá implementar cache offline, validação de manifesto e leitura somente de metadados usando o endpoint público do painel.

A configuração administrativa do Firebase permanece apenas no ambiente do servidor. As regras do Firestore continuam fechadas para acesso direto; o servidor usa a credencial administrativa sem expô-la ao navegador ou ao aplicativo.
