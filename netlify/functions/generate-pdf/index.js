const { Webflow } = require('webflow-api');
const PDFDocument = require('pdfkit');

// Initialize Webflow client
const webflow = new Webflow({
	token: process.env.WEBFLOW_ACCESS_TOKEN,
});

const COLLECTION_IDS = {
	days: '6751551dff6ac96b352ca4c6',
	menus: '6751555ed7176b5124a30b18',
	specials: '6751627b5dd6627f953af343',
};

async function fetchCollectionItems(collectionId) {
	try {
		const items = await webflow.collections.items.listItems({
			collectionId: collectionId,
			limit: 100,
		});
		return items;
	} catch (error) {
		console.error(`Error fetching collection ${collectionId}:`, error);
		throw error;
	}
}

function createPDF(days, menus, specials) {
	const doc = new PDFDocument({
		size: 'A4',
		margin: 50,
	});

	// Add header
	doc.fontSize(24).text('Weekly Menu', { align: 'center' });
	doc.moveDown();

	// Add days and their menus
	days.forEach((day) => {
		doc.fontSize(18).text(day.name);
		doc.moveDown(0.5);

		const dayMenus = day.menuRefs
			.map((menuRef) => menus.find((menu) => menu._id === menuRef))
			.filter(Boolean);

		dayMenus.forEach((menu) => {
			doc.fontSize(14).text(menu.name);
			doc.fontSize(12).text(menu.description);
			doc.moveDown(0.5);
		});

		doc.moveDown();
	});

	// Add specials section
	doc.fontSize(20).text('Daily Specials', { align: 'center' });
	doc.moveDown();

	specials.forEach((special) => {
		const specialMenu = menus.find((menu) => menu._id === special.menuRef);
		if (specialMenu) {
			doc.fontSize(16).text(specialMenu.name);
			doc.fontSize(12).text(specialMenu.description);
			doc.moveDown();
		}
	});

	return doc;
}

exports.handler = async function (event, context) {
	// Only allow GET requests
	if (event.httpMethod !== 'GET') {
		return {
			statusCode: 405,
			body: 'Method Not Allowed',
		};
	}

	try {
		// Fetch all required data
		const [daysItems, menuItems, specialItems] = await Promise.all([
			fetchCollectionItems(COLLECTION_IDS.days),
			fetchCollectionItems(COLLECTION_IDS.menus),
			fetchCollectionItems(COLLECTION_IDS.specials),
		]);

		// Create the PDF
		const doc = createPDF(daysItems, menuItems, specialItems);

		// Set response headers for PDF download
		const headers = {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'attachment; filename=weekly-menu.pdf',
		};

		// Create a buffer to store the PDF
		const chunks = [];
		doc.on('data', (chunk) => chunks.push(chunk));

		return new Promise((resolve, reject) => {
			doc.on('end', () => {
				const pdfBuffer = Buffer.concat(chunks);
				resolve({
					statusCode: 200,
					headers,
					body: pdfBuffer.toString('base64'),
					isBase64Encoded: true,
				});
			});

			doc.on('error', (err) => {
				reject({
					statusCode: 500,
					body: JSON.stringify({ error: 'Failed to generate PDF' }),
				});
			});

			// End the document
			doc.end();
		});
	} catch (error) {
		console.error('Error:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: 'Internal server error' }),
		};
	}
};
