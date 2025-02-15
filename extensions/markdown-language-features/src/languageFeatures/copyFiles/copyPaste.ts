/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Schemes } from '../../util/schemes';
import { createEditForMediaFiles, getMarkdownLink, mediaMimes } from './shared';

class PasteEditProvider implements vscode.DocumentPasteEditProvider {

	private readonly _id = 'insertLink';

	async provideDocumentPasteEdits(
		document: vscode.TextDocument,
		ranges: readonly vscode.Range[],
		dataTransfer: vscode.DataTransfer,
		token: vscode.CancellationToken,
	): Promise<vscode.DocumentPasteEdit | undefined> {
		const enabled = vscode.workspace.getConfiguration('markdown', document).get('editor.filePaste.enabled', true);
		if (!enabled) {
			return;
		}

		const createEdit = await this._getMediaFilesEdit(document, dataTransfer, token);
		if (createEdit) {
			return createEdit;
		}

		const label = vscode.l10n.t('Insert Markdown Media');
		const uriEdit = new vscode.DocumentPasteEdit('', this._id, label);
		const urlList = await dataTransfer.get('text/uri-list')?.asString();
		if (!urlList) {
			return;
		}
		const pasteEdit = await getMarkdownLink(document, ranges, urlList, token);
		if (!pasteEdit) {
			return;
		}

		uriEdit.additionalEdit = pasteEdit.additionalEdits;
		uriEdit.priority = this._getPriority(dataTransfer);
		return uriEdit;
	}

	private async _getMediaFilesEdit(document: vscode.TextDocument, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<vscode.DocumentPasteEdit | undefined> {
		if (document.uri.scheme === Schemes.untitled) {
			return;
		}

		const copyFilesIntoWorkspace = vscode.workspace.getConfiguration('markdown', document).get<'mediaFiles' | 'never'>('editor.filePaste.copyIntoWorkspace', 'mediaFiles');
		if (copyFilesIntoWorkspace === 'never') {
			return;
		}

		const edit = await createEditForMediaFiles(document, dataTransfer, token);
		if (!edit) {
			return;
		}

		const pasteEdit = new vscode.DocumentPasteEdit(edit.snippet, this._id, edit.label);
		pasteEdit.additionalEdit = edit.additionalEdits;
		pasteEdit.priority = this._getPriority(dataTransfer);
		return pasteEdit;
	}

	private _getPriority(dataTransfer: vscode.DataTransfer): number {
		if (dataTransfer.get('text/plain')) {
			// Deprioritize in favor of normal text content
			return -10;
		}
		return 0;
	}
}

export function registerPasteSupport(selector: vscode.DocumentSelector,) {
	return vscode.languages.registerDocumentPasteEditProvider(selector, new PasteEditProvider(), {
		pasteMimeTypes: [
			'text/uri-list',
			...mediaMimes,
		]
	});
}
