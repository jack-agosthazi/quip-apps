// Copyright 2017 Quip

import {AUTH_CONFIG_NAMES} from "./config.js";
import {RecordPickerEntity} from "./model/record-picker.js";
import PlaceholderData from "./placeholder-data.js";

import {
    BooleanFieldEntity,
    DateFieldEntity,
    DateTimeFieldEntity,
    EnumFieldEntity,
    FieldEntity,
    NumericFieldEntity,
    ReferenceFieldEntity,
    TextFieldEntity,
} from "../../shared/base-field-builder/model/field.js";

import {SalesforceRecordEntity} from "./model/salesforce-record.js";

import RecordPicker from "./record-picker.jsx";
import {FieldBuilderMenu} from "./menus.js";
import {SalesforceClient} from "./client.js";

// TODO: actually replace quip.apps.ui.Image.Placeholder with
// quip.apps.ui.Spinner in code when enough clients have it.
if (quip.apps.ui.Spinner) {
    quip.apps.ui.Image.Placeholder = quip.apps.ui.Spinner;
}

quip.apps.registerClass(BooleanFieldEntity, BooleanFieldEntity.ID);
quip.apps.registerClass(DateFieldEntity, DateFieldEntity.ID);
quip.apps.registerClass(DateTimeFieldEntity, DateTimeFieldEntity.ID);
quip.apps.registerClass(EnumFieldEntity, EnumFieldEntity.ID);
quip.apps.registerClass(FieldEntity, FieldEntity.ID);
quip.apps.registerClass(NumericFieldEntity, NumericFieldEntity.ID);
quip.apps.registerClass(RecordPickerEntity, RecordPickerEntity.ID);
quip.apps.registerClass(ReferenceFieldEntity, ReferenceFieldEntity.ID);
quip.apps.registerClass(SalesforceRecordEntity, SalesforceRecordEntity.ID);
quip.apps.registerClass(TextFieldEntity, TextFieldEntity.ID);


console.log('grid-record: ', quip.apps.getRecordById('recordPicker'))

let rootComponent;
export function getRecordComponent() {
    const recordPicker = rootComponent.getWrappedComponent();
    return recordPicker.getRecordComponent();
}

export function getRecordPickerComponent() {
    return rootComponent.getWrappedComponent();
}

const DEV_LOCALLY = false;
const menuDelegate = new FieldBuilderMenu();

quip.apps.initialize({
    menuCommands: menuDelegate.allMenuCommands(),
    toolbarCommandIds: menuDelegate.getDefaultToolbarCommandIds(),
    initializationCallback: function(root, params) {
console.log('*** root: ', root)

        const rootRecord = quip.apps.getRootRecord();
console.log('*** rootRecord before: ', rootRecord)
        const auth = quip.apps.auth(
            rootRecord.useSandbox()
                ? AUTH_CONFIG_NAMES.SANDBOX
                : AUTH_CONFIG_NAMES.PRODUCTION);
        const salesforceClient = new SalesforceClient(auth);
        rootRecord.setClient(salesforceClient);
        //rootRecord.setGrid({
        //    name: "GridBuddy Pipeline View"
        //});
        //const grid = rootRecord.getGrid();
        const grid = {
          name: "GridBuddy Pipeline View"
        }

console.log('*** rootRecord getGrid before: ', rootRecord.getGrid());
        rootRecord.setGrid({name:"GridBuddy Pipeline View"});
console.log('*** rootRecord getGrid after: ', rootRecord.getGrid());
console.log('*** rootRecord after: ', rootRecord)

        ReactDOM.render(
          <div>
              {/*<RecordPicker
                entity={rootRecord}
                menuDelegate={menuDelegate}
                ref={node => {
                    rootComponent = node;
                    rootRecord.setDom(ReactDOM.findDOMNode(node));
                }}/>*/}
              <iframe src={`https://gridbuddydemo--gblite.na35.visual.force.com/apex/gblite__Grid?gname=${encodeURIComponent(grid.name)}&sh=0&ssb=0`} style={{border: '1px solid #0000001f'}} width="100%" height="750" scrolling="auto"></iframe>
          </div>,
            root);
        menuDelegate.refreshToolbar();
    },
});
