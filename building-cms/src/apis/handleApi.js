import axiosClient from './axiosClient';

const callApi = async (url, data, method) => {
	try {
		console.log(`Calling API: ${url}`, { data, method });
		const response = await axiosClient(url, {
			method: method || 'get',
			...(data && { data }),
		});
		console.log('API response:', response);
		return response;
	} catch (error) {
		console.error('API error:', error);
		throw error;
	}
};

export default callApi;
