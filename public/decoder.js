'use strict';

const charCodeOfLowerA = 'a'.charCodeAt(0);
const charCodeOfLowerZ = 'z'.charCodeAt(0);
const isLowerAlphaCharCode = (code) => code >= charCodeOfLowerA && code <= charCodeOfLowerZ;

const charCodeOfUpperA = 'A'.charCodeAt(0);
const charCodeOfUpperZ = 'Z'.charCodeAt(0);
const isUpperAlphaCharCode = (code) => code >= charCodeOfUpperA && code <= charCodeOfUpperZ;

function decoder(message, offset) {
    const codedMessage = [];
    for (let i = 0; i < message.length; i++) {
        codedMessage.push(message.charCodeAt(i));
    }

    return String.fromCharCode(
        ...codedMessage.map(
            letter => isLowerAlphaCharCode(letter)
                ? ((letter - charCodeOfLowerA + offset) % 26 + charCodeOfLowerA)
                : isUpperAlphaCharCode(letter)
                    ? ((letter - charCodeOfUpperA + offset) % 26 + charCodeOfUpperA)
                    : letter
        )
    );
}

function onClickDecode() {
    const inputMessage = document.getElementById('inputMessage');
    const decodedMessages = decodeInputMessage(inputMessage.value);
    displayDecodedMessage(decodedMessages);
}

function decodeInputMessage(messageToDecode) {
    let messageToDisplay = [];
    for (var offset = 1; offset <= 26; offset++) {
        messageToDisplay.push(decoder(messageToDecode, offset));
    }
    return messageToDisplay;
}

function displayDecodedMessage(decodedMessage) {
    const listOfMessage = decodedMessage.map(m => `<li>${m}</li>`);
    document.getElementById('decoderList').innerHTML = `<ol>
        ${listOfMessage.join('\n')}
    </ol>`;
}
