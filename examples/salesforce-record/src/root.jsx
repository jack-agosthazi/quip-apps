// Copyright 2017 Quip

import {AUTH_CONFIG_NAMES} from "./config.js";
import BaseMenu from "../../shared/base-field-builder/base-menu.js";
import Dialog from "../../shared/dialog/dialog.jsx";
import {entityListener} from "../../shared/base-field-builder/utils.jsx";
import {RecordPickerEntity} from "./model/record-picker.js";
import PlaceholderData from "./placeholder-data.js";
import Record from "../../shared/base-field-builder/record.jsx";
import Styles from "./record-picker.less";
import {UnauthenticatedError} from "../../shared/base-field-builder/error.js";
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
import {MismatchedInstanceError, SalesforceClient} from "./client.js";

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
    return getRootComponent().getRecordComponent();
}

export function getRootComponent() {
    return rootComponent.getWrappedComponent();
}

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

        RReactDOM.render(
          <div>
              {/*<WrappedRoot
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

class Root extends React.Component {
    static propTypes = {
        entity: React.PropTypes.instanceOf(RecordPickerEntity).isRequired,
        menuDelegate: React.PropTypes.instanceOf(BaseMenu).isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {
            showRecordPicker: false,
            showMismatchedInstanceError: false,
            prevMenuCommand: null,
        };
    }

    componentDidMount() {
        this.props.menuDelegate.refreshToolbar();
        quip.apps.addEventListener(
            quip.apps.EventType.ELEMENT_BLUR,
            this.hideRecordPicker_);
    }

    componentDidUpdate(prevProps, prevState) {
        this.props.menuDelegate.refreshToolbar();
    }

    componentWillUnmount() {
        quip.apps.removeEventListener(
            quip.apps.EventType.ELEMENT_BLUR,
            this.hideRecordPicker_);
    }

    getRecordComponent() {
        return this.recordComponent_.getWrappedComponent();
    }

    showRecordPicker_ = e => {
        e.preventDefault();
        this.ensureLoggedIn().then(() => {
            this.props.menuDelegate.updateToolbar(
                this.props.entity.getSelectedRecord());
            this.setState({showRecordPicker: true});
        });
    };

    showMismatchedInstanceErrorDialog_(prevMenuCommand) {
        this.hideRecordPicker_();
        this.setState({
            prevMenuCommand,
            showMismatchedInstanceError: true,
        });
    }

    selectRecord_ = selectedRecordId => {
        this.props.entity.setSelectedRecord(selectedRecordId);
        this.hideRecordPicker_();
    };

    hideRecordPicker_ = () => {
        this.setState({showRecordPicker: false});
    };

    changeRecord = () => {
        this.setState({showRecordPicker: true});
    };

    logoutAndReconnect_ = () => {
        this.props.entity
            .logout()
            .then(() => this.dismissMismatchedInstanceErrorDialog_())
            .then(() => this.ensureLoggedIn())
            .then(() => {
                this.props.menuDelegate.updateToolbar(
                    this.props.entity.getSelectedRecord());
                this.props.menuDelegate.executeMenuOption(
                    this.state.prevMenuCommand);
                this.setState({prevMenuCommand: null});
            });
    };

    ensureLoggedIn(prevMenuCommand = null) {
        return this.props.entity.ensureLoggedIn().catch(err => {
            this.handleLoginError_(err, prevMenuCommand);
            // Re-raise so that callers can catch.
            return Promise.reject();
        });
    }

    handleLoginError_(err, prevMenuCommand) {
        if (err instanceof MismatchedInstanceError) {
            this.showMismatchedInstanceErrorDialog_(prevMenuCommand);
            return;
        }
        // Use loginError instead of err object because it's {} when login fails
        const loginError = new UnauthenticatedError(
            "Unable to login to Salesforce");
        this.getRecordComponent().errorHandling(loginError);
    }

    dismissMismatchedInstanceErrorDialog_ = () => {
        this.setState({
            showMismatchedInstanceError: false,
        });
    };

    renderMismatchedInstanceDialog_() {
        return <Dialog onDismiss={this.dismissMismatchedInstanceErrorDialog_}>
            <div className={Styles.errorDialog}>
                <div className={Styles.header}>
                    {quiptext("Reconnect to Salesforce?")}
                </div>
                <div className={Styles.errorTextBlock}>
                    <div className={Styles.errorTextDescription}>
                        {quiptext(
                            "This record is connected to %(hostname1)s " +
                                "but you're logged into %(hostname2)s. Would " +
                                "you like to logout and reconnect to modify " +
                                "this record?",
                            {
                                "hostname1": <b>
                                    {this.props.entity.getHostname()}
                                </b>,
                                "hostname2": <b>
                                    {this.props.entity
                                        .getClient()
                                        .getHostname()}
                                </b>,
                            })}
                    </div>
                </div>
                <div className={Styles.actions}>
                    <quip.apps.ui.Button
                        text={quiptext("Cancel")}
                        onClick={this.dismissMismatchedInstanceErrorDialog_}/>
                    <quip.apps.ui.Button
                        primary={true}
                        text={quiptext("Log Out and Reconnect")}
                        onClick={this.logoutAndReconnect_}/>
                </div>
            </div>
        </Dialog>;
    }

    loginHelpDiv() {
        return <div className={Styles.loginContext}>
            <span>
                {quiptext(
                    "Trouble connecting? Make sure your Quip and Salesforce admin has ")}
            </span>
            <a
                onClick={e => e.stopPropagation()}
                target="_blank"
                href="https://www.quipsupport.com/hc/en-us/articles/115001166766-How-do-I-integrate-Quip-and-Salesforce-">
                {quiptext("already set up the integration")}
            </a>
            <span>
                {quiptext(
                    ", and that your browser isn't blocking the login popup.")}
            </span>
        </div>;
    }

    render() {
        const {showMismatchedInstanceError, showRecordPicker} = this.state;

        const {entity, menuDelegate} = this.props;

        let dialog;
        if (showMismatchedInstanceError) {
            dialog = this.renderMismatchedInstanceDialog_();
        } else if (showRecordPicker) {
            dialog = <RecordPicker
                entity={entity}
                onSelectRecord={this.selectRecord_}
                onDismiss={this.hideRecordPicker_}/>;
        }

        const selectedRecord = entity.getSelectedRecord();
        // Should hit this only in url unfurling case
        if (!selectedRecord) {
            return <quip.apps.ui.Image.Placeholder size={25} loading={true}/>;
        }
        const recordComponent = <Record
            entity={selectedRecord}
            menuDelegate={menuDelegate}
            ref={node => (this.recordComponent_ = node)}/>;

        const recordContainerClassNames = [];
        let chooseRecordButton;
        let contextInstructions;
        let placeholderOverlay;
        let recordContainerOnclick;
        if (selectedRecord && selectedRecord.isPlaceholder()) {
            const loggedIn = entity.getClient().isLoggedIn();
            if (!loggedIn) {
                contextInstructions = this.loginHelpDiv();
            }
            const actionText = loggedIn
                ? quiptext("Select Record…")
                : quiptext("Connect to Salesforce…");
            recordContainerClassNames.push(Styles.placeholder);
            chooseRecordButton = <div className={Styles.openPicker}>
                <quip.apps.ui.Button
                    disabled={showRecordPicker}
                    text={actionText}/>
            </div>;
            placeholderOverlay = <div className={Styles.placeholderOverlay}/>;
            recordContainerOnclick = this.showRecordPicker_;
        }
        return <div className={Styles.root}>
            <div
                className={recordContainerClassNames.join(" ")}
                onClick={recordContainerOnclick}>
                {chooseRecordButton}
                {contextInstructions}
                {placeholderOverlay}
                {recordComponent}
            </div>
            {dialog}
        </div>;
    }
}

const WrappedRoot = entityListener(Root);
