import { jsPDF } from 'jspdf';
import { WebflowClient } from 'webflow-api';
import { logo } from './logo';

// Initialize Webflow client
const webflow = new WebflowClient({
	accessToken: process.env.WEBFLOW_ACCESS_TOKEN,
});

const COLLECTION_IDS = {
	days: '6751551dff6ac96b352ca4c6',
	menus: '6751555ed7176b5124a30b18',
	specials: '6751627b5dd6627f953af343',
};

async function fetchCollectionItems(collectionId) {
	try {
		const items = await webflow.collections.items.listItemsLive(collectionId);
		return items;
	} catch (error) {
		console.error(`Error fetching collection ${collectionId}:`, error);
		throw error;
	}
}

async function fetchMenuById(menuId) {
	if (!menuId) return null;
	try {
		const menu = await webflow.collections.items.getItem(
			COLLECTION_IDS.menus,
			menuId
		);
		return menu;
	} catch (error) {
		console.error(`Error fetching menu ${menuId}:`, error);
		return null;
	}
}

function findMenuById(menus, id) {
	if (!id || !menus) {
		console.error('Invalid input to findMenuById:', {
			id,
			menusLength: menus?.length,
		});
		return '';
	}
	const menu = menus.find((menu) => menu.id === id);
	if (!menu) {
		console.error('Menu not found for id:', id);
	}
	return menu?.fieldData?.name || '';
}

async function createPDF(days, menus, specials) {
	// Create new document
	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4',
	});

	// Verify doc was created
	if (!doc) {
		throw new Error('Failed to create PDF document');
	}

	// Set initial position and constants
	let y = 15;
	const margin = 20;
	const pageWidth = doc.internal.pageSize.width;
	const dayBarExtension = 5; // 5mm extension on each side for day bars

	try {
		// Add logo to top right corner
		const logoWidth = 30; // width in mm
		const logoX = pageWidth - margin - logoWidth; // position from right edge
		const logoY = 10; // position from top
		// Calculate height based on actual dimensions (3576 × 1334)
		const aspectRatio = 3576 / 1334; // width/height
		const logoHeight = logoWidth / aspectRatio;
		doc.addImage(logo, 'PNG', logoX, logoY, logoWidth, logoHeight);

		// Add title
		doc.setFontSize(12);
		doc.setFont(undefined, 'bold');
		doc.text('Wochenmenu', margin, y);
		doc.setFont(undefined, 'normal');
		y += 8;

		// Add subtitle with reduced opacity
		doc.setFontSize(9);
		// Convert black to rgba(0,0,0,0.6) by setting fill color with alpha
		doc.setFillColor(0, 0, 0);
		doc.setTextColor(0, 0, 0);
		const opacity = 0.6;
		doc.saveGraphicsState();
		doc.setGState(new doc.GState({ opacity }));
		doc.text(
			'Tagessuppe mit Brot Fr. 8.- // Tagesmenu klein Fr. 11.- // Tagesmenu gross Fr. 14.-',
			margin,
			y
		);
		doc.restoreGraphicsState();
		y += 10;

		// Sort days by sortierung
		const sortedDays = days.sort(
			(a, b) => a.fieldData.sortierung - b.fieldData.sortierung
		);

		// Add each day's menu
		sortedDays.forEach((day) => {
			// Check if we need a new page
			if (y > 250) {
				doc.addPage();
				y = 20;
			}

			// Add day header with date
			const date = new Date(day.fieldData['datum-feld']);
			const dateStr = date
				.toLocaleDateString('de-CH', {
					weekday: 'long',
					day: '2-digit',
					month: '2-digit',
				})
				.replace(',', '');

			// Extended margins for day header background
			doc.setFillColor(0, 0, 0); // Black background (#000)
			doc.rect(
				margin - dayBarExtension,
				y - 4,
				pageWidth - margin * 2 + dayBarExtension * 2,
				7,
				'F'
			);

			// Set text color for date to #D7DF23 (convert hex to RGB)
			doc.setTextColor(215, 223, 35); // #D7DF23
			doc.setFontSize(9);
			doc.setFont(undefined, 'bold'); // Make days bold
			doc.text(dateStr, margin, y);
			doc.setFont(undefined, 'normal');

			// Reset text color to black for rest of content
			doc.setTextColor(0, 0, 0);
			y += 8;

			// Column positions
			const col1 = margin;
			const col2 = 80;
			const col3 = 140;

			// SUPPE Column
			doc.setFontSize(9);
			doc.setFont(undefined, 'bold');
			doc.text('Suppe', col1, y);
			doc.setFont(undefined, 'normal');
			const suppeMenu = findMenuById(menus, day.fieldData['suppe-1']);
			const suppeLines = doc.splitTextToSize(suppeMenu, 50);
			doc.text(suppeLines, col1, y + 5);

			// MENU Column
			doc.setFont(undefined, 'bold');
			doc.text('Menu', col2, y);
			doc.setFont(undefined, 'normal');
			const mainMenu = findMenuById(menus, day.fieldData['menu-1']);
			const mainMenuLines = doc.splitTextToSize(mainMenu, 50);
			doc.text(mainMenuLines, col2, y + 5);

			// VEGETARISCH Column
			doc.setFont(undefined, 'bold');
			doc.text('Vegetarisch', col3, y);
			doc.setFont(undefined, 'normal');
			const vegiMenu = findMenuById(menus, day.fieldData['vegetarisch-1']);
			const vegiMenuLines = doc.splitTextToSize(vegiMenu, 50);
			doc.text(vegiMenuLines, col3, y + 5);

			y += 25; // Move down for next day
		});

		// Add Specials section
		if (y > 250) {
			doc.addPage();
			y = 20;
		}

		// Add specials header
		doc.setFillColor(0, 0, 0);
		doc.rect(
			margin - dayBarExtension,
			y - 4,
			pageWidth - margin * 2 + dayBarExtension * 2,
			7,
			'F'
		);
		doc.setTextColor(215, 223, 35);
		doc.setFontSize(9);
		doc.setFont(undefined, 'bold');
		doc.text('Specials', margin, y);
		doc.setFont(undefined, 'normal');
		doc.setTextColor(0, 0, 0);
		y += 12;

		// Sort and process specials
		if (specials && specials.length > 0) {
			const sortedSpecials = specials.sort(
				(a, b) => a.fieldData.sortierung - b.fieldData.sortierung
			);

			// Calculate column widths and positions
			const columnWidth = (pageWidth - margin * 2 - 20) / 3; // 20mm total spacing between columns
			const columnSpacing = 10; // 10mm between columns
			const columns = [
				margin,
				margin + columnWidth + columnSpacing,
				margin + (columnWidth + columnSpacing) * 2,
			];

			// Process each special (one per column)
			for (let i = 0; i < sortedSpecials.length; i++) {
				const special = sortedSpecials[i];
				const x = columns[i];
				let localY = y;

				const menu1Id = special.fieldData['menu-1'];
				const menu2Id = special.fieldData['menu-2'];

				// Fetch menu items directly
				const [menu1Data, menu2Data] = await Promise.all([
					fetchMenuById(menu1Id),
					fetchMenuById(menu2Id),
				]);

				// Process menu items for this special
				const menuItems = [menu1Data, menu2Data].filter(Boolean);

				for (const menuData of menuItems) {
					if (!menuData) continue;

					const name = menuData.fieldData.name || '';
					const subtitle = menuData.fieldData.kurzbeschrieb || '';
					const price = menuData.fieldData['regularer-preis'] || '';

					// Calculate text heights
					const nameLines = doc.splitTextToSize(name, columnWidth);

					// Add menu item name
					doc.setFontSize(9);
					doc.setFont(undefined, 'bold');
					doc.text(nameLines, x, localY);
					localY += nameLines.length * 4;

					// Add subtitle with reduced opacity
					if (subtitle) {
						doc.setFont(undefined, 'normal');

						// Set reduced opacity for subtitle
						const opacity = 0.6;
						doc.saveGraphicsState();
						doc.setGState(new doc.GState({ opacity }));

						const subtitleLines = doc.splitTextToSize(subtitle, columnWidth);
						doc.text(subtitleLines, x, localY);
						doc.restoreGraphicsState();

						localY += subtitleLines.length * 4;
					}

					// Add price
					doc.setFont(undefined, 'normal');
					if (price) {
						doc.text(price, x, localY);
						localY += 4;
					}

					// Add minimal spacing between items in the same column
					localY += 2;
				}
			}
		} else {
			console.error('No specials data available');
		}

		// Verify PDF has content before returning
		const pageCount = doc.internal.getNumberOfPages();

		if (pageCount < 1) {
			throw new Error('Generated PDF has no pages');
		}

		return doc;
	} catch (error) {
		console.error('Error during PDF creation:', error);
		throw error;
	}
}

exports.handler = async function (event, context) {
	try {
		// Fetch all required data
		const [daysResponse, menuItems, specialItems] = await Promise.all([
			fetchCollectionItems(COLLECTION_IDS.days),
			fetchCollectionItems(COLLECTION_IDS.menus),
			fetchCollectionItems(COLLECTION_IDS.specials),
		]);

		if (!daysResponse.items.length || !menuItems.items.length) {
			throw new Error('Required data is missing - days or menus are empty');
		}

		// Create the PDF
		const doc = await createPDF(
			daysResponse.items,
			menuItems.items,
			specialItems.items
		);

		// Get PDF as base64
		let pdfBase64;

		try {
			pdfBase64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
		} catch (error) {
			console.error('Error during PDF base64 conversion:', error);
			throw new Error('Failed to convert PDF to base64: ' + error.message);
		}

		if (!pdfBase64) {
			throw new Error(
				'PDF generation resulted in empty base64 string after all conversion attempts'
			);
		}

		// Set response headers for PDF download
		const headers = {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'attachment; filename=wochenmenu.pdf',
			'Cache-Control': 'no-cache',
		};

		return {
			statusCode: 200,
			headers,
			body: pdfBase64,
			isBase64Encoded: true,
		};
	} catch (error) {
		console.error('Error in PDF generation:', error);
		console.error('Error stack:', error.stack);
		return {
			statusCode: 500,
			body: JSON.stringify({
				error: 'Internal server error',
				message: error.message,
				stack: error.stack,
			}),
		};
	}
};
