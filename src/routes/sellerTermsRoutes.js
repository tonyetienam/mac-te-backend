const terms = `1. Seller must be 18+. 2. Products must be original. 3. Payout is weekly. 4. Refunds handled by Mac-TE.`;

router.get('/terms', (req, res) => res.json({ status: 'success', data: terms }));