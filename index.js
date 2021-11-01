const readline = require('readline');
var myfetch = require('./utils/fetch');

const debug = (...args) => undefined; // console.error(...args);

// receives as argument a url
// throws in case of error, otherwise
// do a http request to the given url and returns a promise that resolves to
// an array with two elements, the first element is the baseurl of the final
// request (equal to 'url' if there are no redirects) and the second element is
// the body of the response as text (if its html)
const httpreq = async url => {
	const res = await myfetch(url, {
		headers: {
			'user-agent': 'curl/7.79.0'
		},
		responseType: 'text',
		timeout: 5000,
	});

	const freq = res.request; // final request
	if (res.status < 200 || res.status > 299)
		throw 'NOTOK';
	if (!/\/html/.test(res.headers['content-type']))
		throw 'NOTHTML';
	return [ (!freq ? url : `${freq.protocol}//${freq.host}${freq.path}`), res.data ];
}

// receives as argument a string "website" it can be any of the following
// formats:
// 	"google.com"
// returns asynchronously an array containing the url of the website and the
// html found on the first resolving server of that website, throws otherwise.
// for input "google.com" it tries the following servers, in order:
//	https://google.com/
//	http://google.com/
// example:
// 	"google.com" -> [ 'https://google.com/', "<!doctype html>..." ];
var getwebsite = async website => {
	debug('------------------ in getwebsite...', website);
	let httpserror;
	let httperror;

	if (typeof website !== 'string')
		throw 'INVALIDARG';
	try {
		const baseurl = `https://${website}/`;
		const [ nbaseurl, res ] = await httpreq(baseurl);
		return [ nbaseurl, res ];
	} catch(e) {
		httpserror = e;
		//console.log('error', e);
	}
	try {
		const baseurl = `http://${website}/`;
		const [ nbaseurl, res ] = await httpreq(baseurl);
		return [ nbaseurl, res ];
	} catch(e) {
		throw e;
	}
}

// receives as argument a html string, returns an array of img tags on it
var getimgtags = html => {
	if (typeof html !== 'string')
		throw 'INVALIDARG';
	return html.match(/<img[^>]*>/g) || [];
}

// receives as argument a img tag and returns the value of the src attribute
// returns undefined in case of error.
var getimgsrc = imgtag => {
	if (typeof imgtag !== 'string')
		throw 'INVALIDARG';
	const [ unused, src ] = (imgtag.match(/src="([^"]+)"/i) || []);
	return src;
}
// receives as argument an array of img tags, returns the url of the img that
// looks more like a logotype
var getlogourl = imgtags => {
	if (!Array.isArray(imgtags))
		throw 'ISNOTARRAY';
	if (imgtags.length === 0)
		return ''; // empty url

	// hash of html_tag => rank (dimensionless non-negative integer measuring 'probability' img is a logotype)
	// example:
	// 	<img src="/img.png"> => 0
	// 	<img src="/img2.png" class="logo" > => 1
	const tagsrank = {}; // useful for debugging
	let maxrank = -1;
	let maxtag = '';
	for (const tag of imgtags) {
		let rank = 0;
		if (/logo/.test(tag)) rank++; // increase rank if img tag includes the string 'logo'
		if (/alt=/.test(tag)) rank++; // increase rank if img tag includes an alt attribute
		tagsrank[tag] = rank;
		if (rank > maxrank) {
			maxrank = rank;
			maxtag = tag;
		}
	}

	debug('tagsrank', tagsrank, 'maxrank', maxrank, 'maxtag', maxtag);
	return getimgsrc(maxtag);
}

// receives as argument a baseurl and a url,
// returns the url prefixed with the baseurl argument if the url is a relative
// one, returns url unmodified if its an absolute one.
// throws in case of error
var mkabsoluteurl = (baseurl, url) => {
	if (typeof baseurl !== 'string' || typeof url !== 'string')
		throw 'INVALIDARG';
	if (/^https?:\/\//.test(url)) // is absolute url with schema?
		return url;
	if (/^\/\//.test(url)) { // is schemaless absolute url?
		const [ unused, schema, unused2 ] = baseurl.match(/^([^:]+):\/\//);
		return `${schema}:${url}`;
	}
	return baseurl + url;
}

// receives as argument a website, prints in stdout a two column CSV line with
// format:
// 	website1,url_of_logo1
var procwebsite = async website => {
	try {
		const [ baseurl, html ] = await getwebsite(website);
		debug(`${baseurl} html`, html.slice(0, 128));
		//debug(`${baseurl} getimgtags`, getimgtags(html));
		const logourl = getlogourl(getimgtags(html));
		console.log(`${website},${logourl ? mkabsoluteurl(baseurl, logourl) : ''}`);
	} catch (e) {
		debug(e.code ? e.code : e);
	}
}

async function main() {
	const concurrency = 20;
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false
	})
	const lines = [];

	rl.on('line', line => lines.push(line));
	rl.on('close', async () => {
		for (let i = 0; i < lines.length; i += concurrency) {
			const tmp = lines.slice(i, i + concurrency);
			await Promise.all(tmp.map(t => procwebsite(t)));
		}
	});
}

main();
