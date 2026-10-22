const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Shopify Credentials (Apne store ki details yahan bharein)
const SHOPIFY_STORE_URL = "AAPA_SHOPIFY_STORE_NAME.myshopify.com"; 
const SHOPIFY_ACCESS_TOKEN = "AAPKA_SHOPIFY_ADMIN_API_ACCESS_TOKEN";
const EKQR_API_KEY = "AAPKI_EKQR_API_KEY_YAHAN_DAALEIN";

// 1. Shopify Order Created Webhook
app.post('/api/shopify/order-created', async (req, res) => {
    try {
        const order = req.body;
        const clientTxnId = order.id.toString();

        const ekqrResponse = await axios.post('https://api.ekqr.in/api/create_order', {
            key: EKQR_API_KEY,
            client_txn_id: clientTxnId,
            amount: order.total_price,
            p_info: `Shopify Order #${order.name}`,
            customer_name: order.shipping_address ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}` : "Customer",
            customer_email: order.email || "customer@shopgadgets.online",
            customer_mobile: order.shipping_address?.phone || "9999999999",
            redirect_url: `https://${SHOPIFY_STORE_URL}/pages/thank-you?order_id=${clientTxnId}`
        });

        res.status(200).json({ 
            success: true, 
            payment_url: ekqrResponse.data.data?.payment_url || ekqrResponse.data.payment_url 
        });

    } catch (error) {
        console.error("Error creating EkQR order:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. EkQR Payment Success Webhook
app.post('/api/webhook/ekqr', async (logReq, logRes) => {
    try {
        const paymentData = logReq.body; 

        if (paymentData.status === "success" || paymentData.status === "COMPLETED" || paymentData.status === "SUCCESS") {
            const orderId = paymentData.client_txn_id;
            const transactionUrl = `https://${SHOPIFY_STORE_URL}/admin/api/2026-01/orders/${orderId}/transactions.json`;
            
            await axios.post(transactionUrl, {
                transaction: {
                    kind: "sale",
                    status: "success",
                    amount: paymentData.amount
                }
            }, {
                headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json"
                }
            });

            console.log(`Order #${orderId} successfully verified and marked as Paid!`);
        }

        logRes.status(200).send({ status: "received" });
    } catch (error) {
        console.error("Webhook Error:", error.response?.data || error.message);
        logRes.status(500).send({ error: error.message });
    }
});
// Home route taaki browser mein error na aaye
app.get('/', (req, res) => {
    res.send('Shopify EkQR Payment Gateway Server is Running Successfully! 🚀');
});
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});