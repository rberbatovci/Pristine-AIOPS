import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, isAuthenticated, role, requiredRole }) => {
    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    if (role !== requiredRole) {
        return <Navigate to="/signals" />;
    }

    return children;
};

export default ProtectedRoute;
