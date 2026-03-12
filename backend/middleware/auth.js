// Di setiap route file, tambahkan ini di atas:
const keycloakAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
    next();
};