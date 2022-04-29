import { createInterface } from 'readline';
import { URL } from 'url';
import request from 'request';
import { ResponseError } from "./responseError.js";

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const POSTCODES_BASE_URL = 'https://api.postcodes.io';
const TFL_BASE_URL = 'https://api.tfl.gov.uk';

export default class ConsoleRunner {

    promptForPostcode() {
        return new Promise((resolve) => {
            readline.question('\nEnter your postcode: ', function (postcode) {
                readline.close();
                resolve(postcode);
            });
        });
    }

    displayStopPoints(stopPoints) {
        stopPoints.forEach(point => {
            console.log(point.commonName);
        });
    }

    buildUrl(url, endpoint, parameters) {
        const requestUrl = new URL(endpoint, url);
        parameters.forEach(param => requestUrl.searchParams.append(param.name, param.value));
        return requestUrl.href;
    }

    makeGetRequest(baseUrl, endpoint, parameters) {
        const url = this.buildUrl(baseUrl, endpoint, parameters);
        return new Promise((resolve, reject) => {
            request.get(url, (err, response, body) => {
                if (err) {
                    reject(new ResponseError());
                } else if (response.statusCode !== 200) {
                    let errToReturn = new ResponseError();
                    errToReturn.setResponseCode(response.statusCode);
                    reject(errToReturn);
                } else {
                    resolve(body);
                }
            });
        });
    }

    async getLocationForPostCode(postcode) {
        try {
            const responseBody = await this.makeGetRequest(POSTCODES_BASE_URL, `postcodes/${postcode}`, []);
            const jsonBody = JSON.parse(responseBody);
            return {latitude: jsonBody.result.latitude, longitude: jsonBody.result.longitude};
        } catch (err) {
            err.message = `The following error was encountered while trying to get the location of the postcode: ` + err.message;
            if (err instanceof ResponseError && err.isResponseError()) {
                err.message += `The postcode API returned status code ${err.statusCode}.`;
            }
            throw err;
        }
    }

    async getNearestStopPoints(latitude, longitude, count) {
        try {
            const responseBody = await this.makeGetRequest(
                TFL_BASE_URL,
                `StopPoint`,
                [
                    {name: 'stopTypes', value: 'NaptanPublicBusCoachTram'},
                    {name: 'lat', value: latitude},
                    {name: 'lon', value: longitude},
                    {name: 'radius', value: 1000},
                    {name: 'app_id', value: '' /* Enter your app id here */},
                    {name: 'app_key', value: '' /* Enter your app key here */}
                ]);
            const stopPoints = JSON.parse(responseBody).stopPoints.map(function (entity) {
                return {naptanId: entity.naptanId, commonName: entity.commonName};
            }).slice(0, count);
            if (stopPoints.length === 0) {
                throw new Error("No TfL bus stops found near that postcode.");
            } else {
                return stopPoints;
            }
        } catch(err) {
            err.message = `The following error was encountered while trying to get the nearest bus stops: ` + err.message;
            if (err instanceof ResponseError && err.isResponseError()) {
                err.message += `The StopPoint API returned status code ${err.statusCode}.`;
            }
            throw err;
        }
    }

    async run() {
        try {
            const that = this;
            let postcode = await that.promptForPostcode();
            postcode = postcode.replace(/\s/g, '');
            const location = await that.getLocationForPostCode(postcode);
            const stopPoints = await that.getNearestStopPoints(location.latitude, location.longitude, 5);
            that.displayStopPoints(stopPoints);
        } catch(err) {
            console.log(err.message);
        }
    }
}

