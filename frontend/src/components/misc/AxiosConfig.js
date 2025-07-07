import axios from 'axios';

// Base URL for your backend
const baseUrl = "http://192.168.1.201:8000";

// Create an Axios instance
const apiClient = axios.create({
    baseURL: baseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Add CSRF token and Authorization header
apiClient.interceptors.request.use(
    (config) => {
        const csrfToken = localStorage.getItem('csrfToken');
        const accessToken = localStorage.getItem('accessToken');

        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => {
        console.error("Request error:", error);
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401 errors and token refresh
apiClient.interceptors.response.use(
    (response) => response, // Pass through successful responses
    async (error) => {
        const originalRequest = error.config;

        // Check if error status is 401 and the request isn't already retried
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Mark request as retried

            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    // Request a new access token using the refresh token
                    const refreshResponse = await axios.post(`${baseUrl}/profiles/token/refresh/`, {
                        refresh: refreshToken,
                    });

                    const newAccessToken = refreshResponse.data.access;

                    // Save the new access token in localStorage
                    localStorage.setItem("accessToken", newAccessToken);

                    // Retry the original request with the new token
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return axios(originalRequest);
                } catch (refreshError) {
                    console.error("Token refresh failed:", refreshError);

                    // Redirect to login or handle logout
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    window.location.href = "/logout";
                }
            } else {
                // No refresh token, redirect to login
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/logout";
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
