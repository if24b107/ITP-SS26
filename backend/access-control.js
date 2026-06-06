function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Nicht eingeloggt"
        });
    }

    next();
}

function requireGuest(req, res, next) {
    if (!req.session.guest) {
        return res.status(401).json({
            success: false,
            message: "Gast nicht eingeloggt"
        });
    }

    next();
}

function requireUserOrGuest(req, res, next) {
    if (req.session.user || req.session.guest) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Nicht autorisiert"
    });
}

function denyGuestWrite(req, res, next) {
    if (req.session.guest) {
        return res.status(403).json({
            success: false,
            message: "Gäste besitzen nur Leserechte"
        });
    }

    next();
}

//GAST ZUGANG UND ANZEIGE
//Zur korrekten Userdatenanzeige je nach id und code für den Gast (bei den lesenden Endpoints später einbauen)
function getOwnerUserId(req) {

    if (req.session.user) {
        return req.session.user.id;
    }

    if (req.session.guest) {
        return req.session.guest.ownerUserId;
    }

    return null;
}

module.exports = {
    requireLogin,
    requireGuest,
    requireUserOrGuest,
    denyGuestWrite,
    getOwnerUserId
};