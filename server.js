const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(cors({
    origin: [
        'https://recargadiamant3s.pages.dev', 
        'http://localhost:5173',              
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

const TITANS_URL = 'https://api.titanshub.io/v1/transactions';
const PUBLIC_KEY = process.env.TITANS_PUBLIC_KEY;
const SECRET_KEY = process.env.TITANS_SECRET_KEY;

function gerarCpf() {
  const n = () => Math.floor(Math.random() * 10);
  const n1 = n(), n2 = n(), n3 = n(), n4 = n(), n5 = n(), n6 = n(), n7 = n(), n8 = n(), n9 = n();
  let d1 = n9*2+n8*3+n7*4+n6*5+n5*6+n4*7+n3*8+n2*9+n1*10;
  d1 = 11 - (d1 % 11); if (d1 >= 10) d1 = 0;
  let d2 = d1*2+n9*3+n8*4+n7*5+n6*6+n5*7+n4*8+n3*9+n2*10+n1*11;
  d2 = 11 - (d2 % 11); if (d2 >= 10) d2 = 0;
  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

app.post('/create-payment', async (req, res) => {
  try {
    const { product } = req.body;
    const randomId = Math.floor(Math.random() * 999999);

    const payload = {
      amount: Math.round(product.price * 100), 
      paymentMethod: 'pix',
      items: [{
          title: product.name,
          quantity: 1,
          tangible: false,
          unitPrice: Math.round(product.price * 100),
          externalRef: product.id
      }],
      customer: {
        name: `Cliente Free Fire ${randomId}`,
        email: `comprador${randomId}@pagamento.com`,
        document: { type: "cpf", number: gerarCpf() }
      },
      postbackUrl: "https://google.com" 
    };

    console.log("Enviando Payload:", JSON.stringify(payload));

    const auth = 'Basic ' + Buffer.from(PUBLIC_KEY + ':' + SECRET_KEY).toString('base64');
    
    const response = await axios.post(TITANS_URL, payload, {
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    });

    const titansData = response.data;
    console.log("Resposta da Titans:", JSON.stringify(titansData));

    // --- TENTATIVA DE CORREÇÃO AUTOMÁTICA ---
    // Tenta encontrar o PIX em diferentes lugares que a API possa ter retornado
    let pixCode = null;
    let secureUrl = null;

    // Caminho 1: Documentação Padrão
    if (titansData?.data?.pix?.qrcode) {
        pixCode = titansData.data.pix.qrcode;
        secureUrl = titansData.data.secureUrl;
    } 
    // Caminho 2: Resposta Direta (sem o wrapper 'data')
    else if (titansData?.pix?.qrcode) {
        pixCode = titansData.pix.qrcode;
        secureUrl = titansData.secureUrl;
    }
    // Caminho 3: Variação de nome 'qr_code'
    else if (titansData?.data?.pix?.qr_code) {
        pixCode = titansData.data.pix.qr_code;
    }

    // RESULTADO
    if (pixCode) {
        res.json({
            success: true,
            pixCode: pixCode,
            checkoutUrl: secureUrl
        });
    } else {
        // Se falhar, enviamos a resposta da Titans para o Front entender o erro
        res.status(500).json({
            success: false,
            error: "QR Code não encontrado na resposta",
            // Aqui enviamos o que a Titans mandou de verdade para você depurar
            debug_titans_response: titansData 
        });
    }

  } catch (error) {
    console.error('Erro Fatal:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erro na requisição',
      details: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
