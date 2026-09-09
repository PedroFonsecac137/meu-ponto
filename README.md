# Meu Ponto — Android

Aplicativo offline para registrar horários de estágio, calcular a volta do almoço, a saída prevista e o saldo de horas.

## Baixar

Abra **Releases** e baixe **Meu-Ponto.apk** na versão mais recente. No Android, abra o arquivo para instalar. O APK é uma versão de uso pessoal assinada com chave de teste, como o fluxo inicial do RDV.

## Usar

- O padrão é 6 horas de trabalho e 1 hora de almoço, ajustáveis por dia.
- Saída para almoço às 12h30 indica volta às 13h30.
- Preencha seus horários reais e toque em **Salvar registro**. Dias incompletos também podem ser salvos.
- A saída prevista considera o almoço real quando a volta é preenchida.
- O saldo mensal considera só dias concluídos. Dias sem registro não geram débito.
- Sem horários de almoço, um dia concluído conta como trabalho sem intervalo. Os horários devem estar no mesmo dia.
- **Exportar CSV** abre as opções do Android para salvar ou compartilhar o arquivo.

Os dados ficam nas preferências locais do aplicativo. Desinstalar ou limpar seus dados apaga os registros; exporte uma cópia periodicamente. Os registros da versão do navegador não são transferidos automaticamente. O saldo é acompanhamento pessoal.

## Gerar o APK no GitHub

Em **Actions → Gerar APK do Meu Ponto**, clique em **Run workflow**. Cada envio à branch `main` também inicia a geração. Ao concluir, o APK aparece em **Releases** e nos artefatos da execução.

O workflow usa Java 21 e Android SDK 35. A chave de teste é mantida no cache do GitHub; se esse cache for apagado ou expirar, exporte seus dados antes de reinstalar uma versão com nova assinatura.

## Desenvolvimento

Com Node.js 22.13 ou superior:

```sh
npm ci
npm run android:prepare
```

O projeto Android é gerado automaticamente. Para compilar localmente, use Java 21 e Android SDK 35; execute `./gradlew assembleDebug` na pasta `android` (no Windows, `gradlew.bat assembleDebug`).

O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

Documentação: [Capacitor](https://capacitorjs.com/docs).
