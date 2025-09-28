import { Amplify } from 'aws-amplify';

const cognitoConfig = {
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID,
            region: import.meta.env.VITE_AWS_REGION,
            endpoint: import.meta.env.VITE_AWS_COGNITO_DOMAIN
        }
    }
};

export const configureCognito = () => {
    Amplify.configure(cognitoConfig);
};

export default cognitoConfig;