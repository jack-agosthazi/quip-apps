// Copyright 2017 Quip

import debounce from "lodash.debounce";
import shallowEqual from "shallowequal";
import connectEntity from "./lib/connectEntity";
import registerModels from "./model";
import timePerf from "./lib/timePerf";
import {DefaultCardRenderer} from "../../shared/table-view/DefaultCardRenderer.js";
import {
    toJSON,
    COLUMN_TYPE as TABLE_VIEW_COLUMN_TYPE,
    COLUMN_TYPE_LABELS,
} from "../../shared/table-view/model.js";
import {
    getHeights,
    getWidths,
    ROW_START_HEIGHT,
    ROW_PADDING,
} from "../../shared/table-view/utils";
import {COLUMN_TYPE, RootRecord} from "./model.js";
import {TableView} from "../../shared/table-view/table-view.jsx";

class Root extends React.Component {
    static propTypes = {
        record: React.PropTypes.instanceOf(RootRecord).isRequired,
        columns: React.PropTypes.instanceOf(quip.apps.RecordList).isRequired,
        rows: React.PropTypes.instanceOf(quip.apps.RecordList).isRequired,
        rowCount: React.PropTypes.number.isRequired,
        columnCount: React.PropTypes.number.isRequired,
        widths: React.PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);

        // Heights are local state and not synced to the server
        // Widths are synced to the server, but get read from state in order to
        // update the UI while also allowing saves to be debounced
        this.state = {
            widths: getWidths(
                props,
                props.widths,
                this.getDefaultWidth,
                this.getMinWidth),
            heights: getHeights(props),
        };
    }

    componentWillReceiveProps(nextProps) {
        const {
            rowCount: nextRowCount,
            columnCount: nextColumnCount,
            widths: nextWidths,
        } = nextProps;
        const {rowCount, columnCount} = this.props;
        const {heights, widths} = this.state;
        const newState = {};

        if (nextRowCount !== rowCount) {
            newState.heights = getHeights(nextProps, heights);
        }

        if (nextColumnCount !== columnCount) {
            newState.widths = getWidths(
                nextProps,
                widths,
                this.getDefaultWidth,
                this.getMinWidth);
        } else if (nextWidths && !shallowEqual(widths, nextWidths)) {
            // If new widths are coming in as props but they dont match state
            // then its a remote update so state should be reset to match
            newState.widths = getWidths(
                nextProps,
                Object.assign({}, widths, nextWidths),
                this.getDefaultWidth,
                this.getMinWidth);
        }

        if (newState.heights || newState.widths) {
            this.setState(newState);
        }
    }

    setRowHeight_ = (rowId, columnId, height) => {
        this.setState(({heights}) => ({
            heights: Object.assign(heights, {
                [rowId]: Object.assign(heights[rowId] || {}, {
                    // Height comes directly from RichTextBoxes so we need to
                    // add padding back in
                    [columnId]: Math.max(
                        height + ROW_PADDING,
                        ROW_START_HEIGHT),
                }),
            }),
        }));
    };

    setWidths = newWidths => {
        this.setState(({widths}) => ({
            widths: Object.assign(widths, newWidths),
        }));
    };

    getMinPersonWidth = id => {
        const record = quip.apps.getRecordById(id);
        const users = record.getCells();
        const max = Math.max.apply(null, users.map(u => u.getUsers().length));
        if (max > 4) return 150;
        /* From here we start at 128 (removed the `+N`) and
          subtract (Picture width (30 at time of writing) - negative
          margin we add in owner.jsx (12 at time of writing)). This could
          be a function but it's fine for now I think?
          **/
        if (max === 4) return 128;
        if (max === 3) return 110;
        if (max === 2) return 92;
        return 74;
    };

    getMinWidth = (id, type) => {
        switch (type) {
            case COLUMN_TYPE.TEXT:
                return 150;
            case COLUMN_TYPE.DATE:
                return 120;
            case COLUMN_TYPE.FILE:
                return 120;
            case COLUMN_TYPE.STATUS:
                return 120;
            case COLUMN_TYPE.PERSON:
                return this.getMinPersonWidth(id);
            default:
                return 120;
        }
    };

    getDefaultWidth = record => {
        switch (record.get("type")) {
            case COLUMN_TYPE.TEXT:
                return 214;
            case COLUMN_TYPE.DATE:
                return 158;
            case COLUMN_TYPE.FILE:
                return 158;
            case COLUMN_TYPE.STATUS:
                return 158;
            case COLUMN_TYPE.PERSON:
                return 112;
            default:
                return 158;
        }
    };

    onResizeEnd_ = () => {
        this.saveWidths_();
    };

    saveWidths_ = () => {
        this.props.record.set("widths", this.state.widths);
    };

    onRowDrop_ = (id, index) => {
        this.props.record.get("rows").move(quip.apps.getRecordById(id), index);
    };

    onRowDelete_ = id => {
        quip.apps.getRecordById(id).delete();
    };

    onColumnDrop_ = (id, index) => {
        this.props.record
            .get("columns")
            .move(quip.apps.getRecordById(id), index);
    };

    onColumnAdd_ = (id, type, index) => {
        quip.apps.getRootRecord().addColumn(type, index);
    };

    onColumnDelete_ = id => {
        const column = quip.apps.getRecordById(id);
        column
            .getParentRecord()
            .getRows()
            .forEach(row => {
                row.getCell(column).delete();
            });
        column.delete();
    };

    getElementFn_ = cell => {
        switch (cell.getType()) {
            case COLUMN_TYPE.TEXT:
                return element =>
                    element.get("contents").getTextContent() || "";
            case COLUMN_TYPE.DATE:
                return element => element.getDate() || 0;
            case COLUMN_TYPE.FILE:
                return element => {
                    // Sort by file name
                    const blobId = element.getBlob();
                    return blobId
                        ? quip.apps.getBlobById(blobId).filename()
                        : "";
                };
            case COLUMN_TYPE.STATUS:
                return (element, column) => {
                    // Sort by status text
                    const id = element.getStatus();
                    return id ? column.getStatusById(id).getText() : "";
                };
            case COLUMN_TYPE.PERSON:
                return element => {
                    // Sort by first user's full name
                    const users = element.getUsers();
                    return users.length ? users[0].getName() : "";
                };
            default:
                return element => element;
        }
    };

    onColumnSort_ = (id, isAscending) => {
        const column = quip.apps.getRecordById(id);
        const rows = column.getParentRecord().getRows();
        const getElement = this.getElementFn_(column);
        rows.sort((a, b) => {
            const elementA = getElement(a.getCell(column), column);
            const elementB = getElement(b.getCell(column), column);
            if (elementA > elementB) {
                return isAscending ? 1 : -1;
            }
            if (elementA < elementB) {
                return isAscending ? -1 : 1;
            }
            return 0;
        });
        const recordRows = this.props.record.get("rows");
        rows.forEach((row, i) => {
            recordRows.move(row, i);
        });
    };

    render() {
        const {record} = this.props;
        const {rows, columns} = toJSON(record);
        const {widths, heights} = this.state;

        return <TableView
            ref={node => record.setDom(ReactDOM.findDOMNode(node))}
            customRenderer={DefaultCardRenderer()}
            columns={columns}
            rows={rows}
            heights={heights}
            widths={widths}
            setRowHeight={quip.apps.isMobile() ? this.setRowHeight_ : undefined}
            setWidths={this.setWidths}
            getMinWidth={this.getMinWidth}
            onColumnDrop={this.onColumnDrop_}
            onColumnAdd={this.onColumnAdd_}
            onColumnDelete={this.onColumnDelete_}
            onColumnSort={this.onColumnSort_}
            onRowDrop={this.onRowDrop_}
            onRowDelete={this.onRowDelete_}
            onResizeEnd={this.onResizeEnd_}
            onCardClicked={(id, column) => {
                if (column.type === COLUMN_TYPE.TEXT) {
                    quip.apps
                        .getRecordById(id)
                        .get("contents")
                        .focus();
                }
            }}
            metricType={"project_tracker"}/>;
    }
}

registerModels();

quip.apps.initialize({
    initializationCallback: (root, {isCreation}) => {
        const rootRecord = quip.apps.getRootRecord();

        // Render performance timer
        timePerf("Init To Render", () => rootRecord.getDom());

        if (isCreation) {
            rootRecord.seed();
        } else {
            if (rootRecord.getDataVersion() < RootRecord.DATA_VERSION) {
                // Migrate data to new format
                const columns = rootRecord.getColumns();
                const statusTypes = rootRecord.get("statusTypes").getRecords();
                /** @private {Map<string, string>} */
                const migrationMap = new Map();
                columns.forEach(function(col) {
                    if (col.getType() == "status") {
                        let record;
                        statusTypes.forEach(function(status) {
                            record = col.addStatusType(
                                status.getText(),
                                status.getColor());
                            migrationMap.set(status.getId(), record.getId());
                        });
                        const cells = col.getCells();
                        cells.forEach(function(cell) {
                            const status = cell.getStatus();
                            if (status) {
                                cell.setStatus(migrationMap.get(status));
                            }
                        });
                    }
                });
                rootRecord.setDataVersion(RootRecord.DATA_VERSION);
            }
        }

        const Connected = connectEntity(rootRecord, Root, {
            isV2: true,
            mapStateToProps: state => ({
                rowCount: state.rows.count(),
                columnCount: state.columns.count(),
            }),
        });

        ReactDOM.render(<Connected/>, root);
    },
    toolbarCommandIds: ["addRow"],
    menuCommands: [
        {
            id: "sortAscending",
            label: quiptext("Sort Ascending"),
            handler: (name, context) => context[name](),
        },
        {
            id: "sortDescending",
            label: quiptext("Sort Descending"),
            handler: (name, context) => context[name](),
        },
        {
            id: "addColumn",
            label: quiptext("Add Column"),
            subCommands: Object.keys(COLUMN_TYPE).map(
                type => type + "AddColumn"),
        },
        {
            id: "addRow",
            label: quiptext("Add Row"),
            handler: () => quip.apps.getRootRecord().addRow(),
        },
        {
            id: "deleteColumn",
            label: quiptext("Delete Column"),
            handler: (name, context) => context[name](),
        },
        {
            id: "deleteRow",
            label: quiptext("Delete Row"),
            handler: (name, context) => context[name](),
        },
        ...Object.keys(COLUMN_TYPE).map(type => ({
            id: type + "AddColumn",
            label: COLUMN_TYPE_LABELS[TABLE_VIEW_COLUMN_TYPE[type]],
            isHeader: false,
            handler: (name, context) => context["addColumn"](type),
        })),
    ],
});
