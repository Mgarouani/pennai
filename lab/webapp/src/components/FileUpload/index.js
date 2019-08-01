//require('es6-promise').polyfill();
//import fs = require('fs');
import fetch from 'isomorphic-fetch';
import { connect } from 'react-redux';
import React, { Component } from 'react';
import { getSortedDatasets } from '../../data/datasets';
import { fetchDatasets } from '../../data/datasets/actions';
import { uploadDataset } from '../../data/datasets/dataset/actions';
import FileUploadForm from './components/FileUploadForm'
import SceneHeader from '../SceneHeader';
import SortableList from './components/SortableList';
import { put } from '../../utils/apiHelper';
import Papa from 'papaparse';
import {
  Button,
  Input,
  Form,
  Segment,
  Table,
  Popup,
  Checkbox,
  Header,
  Accordion,
  Icon,
  Label,
  Dropdown,
  Modal
} from 'semantic-ui-react';

class FileUpload extends Component {
  /**
 * FileUpload reac component - UI form for uploading datasets
 * @constructor
 */
  constructor(props) {
    super(props);

    this.state = {
      selectedFile: null,
      dependentCol: '',
      catFeatures: '',
      ordinalFeatures: {},
      ordKeys: [],
      ordinalIndex: 0,
      activeAccordionIndexes: [],
      ordModal: false
    };

    // enter info in text fields
    this.handleDepColField = this.handleDepColField.bind(this);
    this.handleCatFeatures = this.handleCatFeatures.bind(this);
    this.handleOrdinalFeatures = this.handleOrdinalFeatures.bind(this);
    this.getDataTablePreview = this.getDataTablePreview.bind(this);
    this.getAccordionInputs = this.getAccordionInputs.bind(this);
    this.generateFileData = this.generateFileData.bind(this);
    this.errorPopupTimeout = this.errorPopupTimeout.bind(this);
    this.getDataKeys = this.getDataKeys.bind(this);
    this.getDropDown = this.getDropDown.bind(this);
    this.depColDropDownClickHandler = this.depColDropDownClickHandler.bind(this);
    this.catDropDownClickHandler = this.catDropDownClickHandler.bind(this);
    this.ordDropDownClickHandler = this.ordDropDownClickHandler.bind(this);
    this.isJson = this.isJson.bind(this);
    this.ordModalClose = this.ordModalClose.bind(this);
    //this.cleanedInput = this.cleanedInput.bind(this)

    // help text for dataset upload form - dependent column, categorical & ordinal features
    this.depColHelpText = `The column that describes how each row is classified.
    For example, if analyzing a dataset of patients with different types of diabetes,
    this column may have the values "type1", "type2", or "none".`;

    this.catFeatHelpText = (<p>Categorical features have a discrete number of categories that do not have an intrinsic order.
    Some examples include sex ("male", "female") or eye color ("brown", "green", "blue"...).
    <br/><br/>
    Describe these features using a comma separated list of the field names:
    <i>sex, eye_color</i></p>);

    this.ordFeatHelpText = (<p>Ordinal features have a discrete number of categories,
    and the categories have a logical order. Some examples include size ("small",
    "medium", "large"), or rank results ("first", "second", "third").
    <br/><br/>
    Describe these features using a json map. The map key is the name of the field,
     and the map value is an ordered list of the values the field can take:
    <i>{"{\"rank\":[\"first\", \"second\", \"third\"], \"size\":[\"small\", \"medium\", \"large\"]}"}</i></p>);
  }

  /**
  * React lifecycle method, when component loads into html dom, 'reset' state
  */
  componentDidMount() {
    this.setState({
      selectedFile: null,
      dependentCol: '',
      catFeatures: '',
      ordinalFeatures: '',
      ordinalIndex: 0,
      ordOrderList: [],
      activeAccordionIndexes: [],
      errorResp: undefined
    });
  }

  /**
   * Strip input of potentially troublesome characters, from here:
   * https://stackoverflow.com/questions/3780696/javascript-string-replace-with-regex-to-strip-off-illegal-characters
   * need to figure out what characters will be allowed
   *
   * @param {string} inputText - user input.
   * @returns {string} stripped user input of bad characters
   */
  purgeUserInput(inputText) {
    let cleanedInput = inputText.replace(/[|&;$%@<>()+]/g, "");
    return cleanedInput;
  }

  /**
   * Text field for entering dependent column, sets component react state with
   * user input
   * @param {Event} e - DOM Event from user interacting with UI text field
   * @param {Object} props - react props object
   * @returns {void} - no return value
   */
  handleDepColField(e) {
    //let safeInput = this.purgeUserInput(props.value);
    //window.console.log('safe input: ', safeInput);
    this.setState({
      dependentCol: e.target.value,
      errorResp: undefined
    });
  }

  /**
   * text field/area for entering categorical features
   * user input
   * @param {Event} e - DOM Event from user interacting with UI text field
   * @returns {void} - no return value
   */
  handleCatFeatures(e) {
    //let safeInput = this.purgeUserInput(e.target.value);
    //window.console.log('safe input cat: ', safeInput);
    this.setState({
      catFeatures: e.target.value,
      errorResp: undefined
    });
  }

  /**
   * text field/area for entering ordinal features
   * user input
   * @param {Event} e - DOM Event from user interacting with UI text field
   * @param {Object} props - react props object
   * @returns {void} - no return value
   */
  handleOrdinalFeatures(e) {
    //window.console.log('ord props: ', props);
    //let safeInput = this.purgeUserInput(props.value);
    //window.console.log('safe input ord: ', safeInput);
    this.setState({
      ordinalFeatures: e.target.value,
      errorResp: undefined
    });
  }

  /**
   * Helper method to consolidate user input to send with file upload form
   * @returns {FormData} - FormData object containing user input data
   */
  generateFileData = () => {
    const data = new FormData();
    this.setState({errorResp: undefined});
    let depCol = this.state.dependentCol;
    let ordFeatures = this.state.ordinalFeatures;
    let catFeatures = this.state.catFeatures;
    let selectedFile = this.state.selectedFile;
    let tempOrdinalFeats = '';
    if(selectedFile && selectedFile.name) {
      // get raw user input from state

      // try to parse ord features input as JSON if not empty
      if(ordFeatures !== '' ) {
        try {
          // only try to parse input with JSON.parse() if string
          if(typeof ordFeatures === 'string') {
            tempOrdinalFeats = JSON.parse(ordFeatures);
          } else if(this.isJson(ordFeatures)) {
            tempOrdinalFeats = ordFeatures;
          }
        } catch(e) {
          // if expecting oridinal stuff, return error to stop upload process
          return { errorResp: e.toString() };
        }
      }

      if(catFeatures !== '') {
        // remove all whitespace
        catFeatures = catFeatures.replace(/ /g, '');
        // parse on comma
        catFeatures = catFeatures.split(',');
        // if input contains empty items - ex: 'one,,two,three'
        // filter out resulting empty item
        catFeatures = catFeatures.filter(item => {
          return item !== ''
        })
      }

      // keys specified for server to upload repsective fields,
      // filter
      let metadata =  JSON.stringify({
                'name': this.state.selectedFile.name,
                'username': 'testuser',
                'timestamp': Date.now(),
                'dependent_col' : depCol,
                'categorical_features': catFeatures,
                'ordinal_features': tempOrdinalFeats
              });

      data.append('_metadata', metadata);

      data.append('_files', this.state.selectedFile);
      // before upload get a preview of what is in dataset file

      //window.console.log('preview of uploaded data: ', dataPrev);
      // after uploading a dataset request new list of datasets to update the page
    } else {
      window.console.log('no file available');
    }

    return data;
  }

  /**
   * Event handler for selecting files, takes user file from html file input, stores
   * selected file in component react state, generates file preview and stores that
   * in the state as well. If file is valid does the abovementioned, else error
   * is generated
   * @param {Event} event - DOM Event from user interacting with UI text field
   * @returns {void} - no return value
   */
  handleSelectedFile = event => {

    const fileExtList = ['csv', 'tsv'];
    let papaConfig = {
      header: true,
      preview: 5,
      complete: (result) => {
        //window.console.log('preview of uploaded data: ', result);
        this.setState({datasetPreview: result});
      }
    };

    // check for selected file
    if(event.target.files && event.target.files[0]) {
      // immediately try to get dataset preview on file input html element change
      // need to be mindful of garbage data/files
      //console.log(typeof event.target.files[0]);
      //console.log(event.target.files[0]);
      let uploadFile = event.target.files[0]
      let fileExt = uploadFile.name.split('.').pop();

      //Papa.parse(event.target.files[0], papaConfig);
      // check file extensions
      if (fileExtList.includes(fileExt)) {
        // use try/catch block to deal with potential bad file input when trying to
        // generate file/csv preview, use filename to check file extension
        try {
          Papa.parse(uploadFile, papaConfig);
        }
        catch(error) {
          console.error('Error generating preview for selected file:', error);
          this.setState({
            selectedFile: undefined,
            errorResp: JSON.stringify(error),
            datasetPreview: null,
            openFileTypePopup: false,
            dependentCol: '',
            catFeatures: '',
            ordinalFeatures: '',
            ordKeys: []
          });
        }
        // set state with file preview if parse successful, reset form input
        this.setState({
          selectedFile: event.target.files[0],
          errorResp: undefined,
          datasetPreview: null,
          openFileTypePopup: false,
          dependentCol: '',
          catFeatures: '',
          ordinalFeatures: '',
          ordKeys: []
        });
      } else {
        // reset state as fallback if no file type is not supported
        console.warn('Filetype not csv or tsv:', uploadFile);
        this.setState({
          selectedFile: null,
          datasetPreview: null,
          errorResp: undefined,
          openFileTypePopup: true,
          dependentCol: '',
          catFeatures: '',
          ordinalFeatures: '',
          ordKeys: []
        });
      }
    } else {
      // reset state as fallback if no file selected
      this.setState({
        selectedFile: null,
        datasetPreview: null,
        errorResp: undefined,
        openFileTypePopup: false,
        dependentCol: '',
        catFeatures: '',
        ordinalFeatures: '',
        ordKeys: []
      });
    }
  }

  /**
   * Starts download process, takes user input, creates a request payload (new html Form)
   * and sends data to server through redux action, uploadDataset, which is a promise.
   * When promise resolves update UI or redirect page depending on success/error.
   * Upon error display error message to user, on success redirect to dataset page
   * @returns {void} - no return value
   */
  handleUpload = () => {
    const { uploadDataset } = this.props;
    // only attempt upload if there is a selected file with a filename
    if(this.state.selectedFile && this.state.selectedFile.name) {
      let data = this.generateFileData(); // should be FormData
      // if trying to create FormData results in error, don't attempt upload
      if (data.errorResp) {
        this.setState({errorResp: data.errorResp});
      } else {
        // after uploading a dataset request new list of datasets to update the page
        uploadDataset(data).then(stuff => {
          //window.console.log('FileUpload props after download', this.props);


          //let resp = Object.keys(this.props.dataset.fileUploadResp);
          let resp = this.props.dataset.fileUploadResp;
          let errorRespObj = this.props.dataset.fileUploadError;

          // if no error message and successful upload (indicated by presence of dataset_id)
          // 'refresh' page when upload response from server is not an error and
          // redirect to dataset page, when error occurs set component state
          // to display popup containing server/error response
          if (!errorRespObj && resp.dataset_id) {
            this.props.fetchDatasets();
            window.location = '#/datasets';
          } else {
            this.setState({
               errorResp: errorRespObj.errorResp.error || "Something went wrong"
              })
          }
        });
      }


    } else {
      window.console.log('no file available');
      this.setState({
        errorResp: 'No file available'
      });
    }

  }
  /**
   * Accordion click handler which updates active index for different text areas
   * in dataset upload form, use react state to keep track of which indicies are
   * active & also clear any error message
   */
  handleAccordionClick = (e, titleProps) => {
     const { index } = titleProps;
     const { activeAccordionIndexes } = this.state;
     // make copy of array in state
     const newIndex = [...activeAccordionIndexes];
     const currentIndexPosition = activeAccordionIndexes.indexOf(index);

     if (currentIndexPosition > -1) {
       newIndex.splice(currentIndexPosition, 1);
     } else {
       newIndex.push(index);
     }

     this.setState({
       activeAccordionIndexes: newIndex,
       errorResp: undefined
     })

   }

  /**
  * Get list of keys/column names from data preview
  * @returns {Array} - use js Object.keys(...) to get list of keys
  */
  getDataKeys() {
    const { datasetPreview } = this.state;
    let dataKeys = [];
    if(datasetPreview) {
      //dataKeys = Object.keys(datasetPreview);
      dataKeys = datasetPreview.meta.fields;
    }
    return dataKeys;
  }

  /**
  * simple click handler for selecting dependent column
  */
  depColDropDownClickHandler(e, d) {
    this.setState({
      dependentCol: d.text
    });
  }

  /**
  * take selected key and generate comma separated list of values for given key
  */
  catDropDownClickHandler(e, d) {
    const { datasetPreview, catFeatures } = this.state;
    let selectedKey = d.text;
    let tempList;
    // if categorical features is not empty, try to split on comma
    catFeatures !== '' ? tempList = catFeatures.split(',') : tempList = [];
    // keep track of if currently selected category is already in list
    let catIndex = tempList.indexOf(selectedKey);
    // if category already in list, remove it, else add it
    catIndex > -1 ? tempList.splice(catIndex, 1) : tempList.push(selectedKey);
    this.setState({
      catFeatures: tempList.join()
    });
  }

  /**
  * take selected key and generate comma separated list of values for given key
  */
  ordDropDownClickHandler(e, d) {
    const { datasetPreview, ordKeys, ordinalFeatures } = this.state;
    let selectedKey = d.text;
    //let tempOrdKeys = [...ordKeys];
    let tempOrdKeys = [];
    // if ordinalFeatures is proper json, can get keys
    if(typeof ordinalFeatures !== 'string' && this.isJson(ordinalFeatures)) {
      tempOrdKeys = Object.keys(ordinalFeatures);
    } else if(ordinalFeatures !== ""){ // else try to parse and get keys
      window.console.log('trying to parse', ordinalFeatures);
      let tempObj;
      try {
          tempObj = JSON.parse(ordinalFeatures);
          tempOrdKeys = Object.keys(tempObj)
      } catch (e) {
          window.console.error(' uh o ----> ', e);
          //return false;
      }
    }

    let tempOrdFeats = {};
    let ordIndex = tempOrdKeys.indexOf(selectedKey);
    // keep track of currently selected ordinal feature(s)
    ordIndex > -1 ? tempOrdKeys.splice(ordIndex, 1) : tempOrdKeys.push(selectedKey);
    tempOrdKeys.forEach(ordKey => {
      let tempVals = [];
      datasetPreview.data.forEach(row => {
        //tempOrdFeats[ordKey] = row[ordKey];
        !tempVals.includes(row[ordKey]) ? tempVals.push(row[ordKey]) : null;
      })
      tempOrdFeats[ordKey] = tempVals;
    });
    window.console.log('temp ord feats list for dropdown', tempOrdFeats);
    this.setState({
      ordKeys: tempOrdKeys,
      ordinalFeatures: tempOrdFeats,
      ordModal: true
    });
  }

  /**
  * use to close popup when select
  */
  ordModalClose() {
    this.setState({ ordModal: false });
  }
  /**
  *  Simple timeout function, resets error message
  */
  errorPopupTimeout() {
    this.setState({
      errorResp: undefined
    });
  }
  /*
  * Basic helper to test for JSON
  * https://stackoverflow.com/questions/9804777/how-to-test-if-a-string-is-json-or-not
  */
  isJson(item) {
      item = typeof item !== 'string'
          ? JSON.stringify(item)
          : item;

      try {
          item = JSON.parse(item);
      } catch (e) {
          return false;
      }

      if (typeof item === 'object' && item !== null) {
          return true;
      }

      return false;
  }
  /****************************************************************************/
  /*        Helper methods to create inputs & form elements                   */
  /****************************************************************************/

  /**
  * create dropdown menu of data column dataKeys, pass in callback for each item
  */
  getDropDown(dropDownClickHandler) {
      //window.console.log('making dropdown');
      let tempKeys = this.getDataKeys();
      let dropDown = [];
      let dropDownObjList = [];
      tempKeys.forEach((key, i) =>{
          //window.console.log('making dropdown', i);
          dropDownObjList.push({
            key: key + '_' + i,
            value: key,
            text: key,
            onClick: dropDownClickHandler
          })
          // dropDown.push((
          //   <Dropdown.Item
          //     onClick={dropDownClickHandler}
          //     key={key}
          //     text={key}
          //   />
          // ))
        }
      );
      //window.console.log('dropdown stuff ', dropDownObjList);
      //return dropDown;
      return dropDownObjList;
  }

  /**
   * Small helper method to create table for dataset preview upon selecting csv file.
   * Copied from Dataset component - relies upon javascript library papaparse to
   * partially read selected file and semantic ui to generate preview content,
   * if no preview available return hidden paragraph, otherwise return table
   * @returns {html} - html to display
   */
  getDataTablePreview() {
    let dataPrev = this.state.datasetPreview;
    let dataPrevTable = ( <p style={{display: 'none'}}> hi </p> );
    let innerContent;

    if(dataPrev && dataPrev.data) {
      innerContent = dataPrev.data.slice(0, 100).map((row, i) =>
        <Table.Row key={i}>
          {dataPrev.meta.fields.map(field => {
              let tempKey = i + field;
              return (
                <Table.Cell key={'dataTablePrev_' + tempKey.toString()}>
                  {row[field]}
                </Table.Cell>
              )
            }
          )}
        </Table.Row>
      );

      dataPrevTable = (
        <div>
          <br/>
          <Header as='h2' inverted color='grey'>
            Dataset preview
          </Header>
          <div style={{ overflowY: 'auto', maxHeight: '350px' }}>
            <Table inverted celled compact unstackable singleLine>
              <Table.Header>
                <Table.Row>
                  {dataPrev.meta.fields.map(field =>
                    <Table.HeaderCell key={field}>{field}</Table.HeaderCell>
                  )}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {innerContent}
              </Table.Body>
            </Table>
          </div>
          <br/>
        </div>
      )
    }
    return dataPrevTable;
  }

  /**
   * Small helper method to create semantic ui accordion for categorical &
   * ordinal text inputs
   * @returns {html} - html ui input elements
   */
   getAccordionInputs() {
     const { activeAccordionIndexes, ordinalFeatures, ordKeys, ordOrderList, catFeatures } = this.state;
     let catDropdown = this.getDropDown(this.catDropDownClickHandler);
     let ordDropdown = this.getDropDown(this.ordDropDownClickHandler);
     let ordTextAreaVal;
     let ordIconClass; // CSS class to position help icon

     // check input type for string to prevent attempting to stringify a string
     this.isJson(ordinalFeatures) && typeof ordinalFeatures !== "string"
       ? ordTextAreaVal = JSON.stringify(ordinalFeatures)
       : ordTextAreaVal = ordinalFeatures;

     // determine which combos of accordions are open and set respective CSS class
     activeAccordionIndexes.includes(1)
       ? ordIconClass = "file-upload-ord-with-cat-help-icon"
       : ordIconClass = "file-upload-ordinal-help-icon";
     activeAccordionIndexes.includes(0)
       ? ordIconClass = "file-upload-just-ordinal-help-icon" : null;
     activeAccordionIndexes.includes(1) && activeAccordionIndexes.includes(0)
       ? ordIconClass = "file-upload-ord-and-cat-help-icon" : null;

     let ordModalContent = [];

     Object.keys(ordinalFeatures).forEach(selectedOrdKey => {
       ordModalContent.push( (
           <div key={selectedOrdKey}>
              select order for: {selectedOrdKey}
              <br/>
              select_order_mock: {
                      <Segment>
                        <h3>test drag n' drop list</h3>
                        <SortableList
                          items={
                            ordinalFeatures[selectedOrdKey] && ordinalFeatures[selectedOrdKey].length
                              ? ordinalFeatures[selectedOrdKey] : []
                          }
                          onChange={(items_test) => {
                            let tempOrdState = {...ordinalFeatures};
                            tempOrdState[selectedOrdKey] = items_test;
                            window.console.log('new order', items_test);
                            this.setState({ordinalFeatures: tempOrdState})
                            //this.setState({items_test});
                          }}
                        />
                      </Segment>
                  }
                )}
           </div>
         )
       )
     })

     let accordionContent = (
       <div>
        <Accordion fluid exclusive={false}>
           <Accordion.Title
             className="file-upload-categorical-accord-title"
             active={activeAccordionIndexes.includes(1)}
             index={1}
             onClick={this.handleAccordionClick}
            >
             <Icon name='dropdown' />
             Enter Categorical Features
           </Accordion.Title>
             <Popup
               on="click"
               position="right center"
               header="Categorical Features Help"
               content={
                 <div className="content">
                  {this.catFeatHelpText}
                 </div>
               }
               trigger={
                 <Icon
                   className="file-upload-categorical-help-icon"
                   inverted
                   size="large"
                   color="orange"
                   name="info circle"
                 />
               }
             />
           <Accordion.Content
             active={activeAccordionIndexes.includes(1)}
            >
              <Dropdown
                style={{
                  width: '100%'
                }}
                text="Select categorical features"
                search
                selection
                multiple
                value={catFeatures.split(',')}
                options={catDropdown}
              >
              </Dropdown>
             <textarea
               className="file-upload-categorical-text-area"
               id="categorical_features_text_area_input"
               label="Categorical Features"
               placeholder={"cat_feat_1, cat_feat_2"}
               value={this.state.catFeatures ? this.state.catFeatures : ""}
               onChange={this.handleCatFeatures}
             />

           </Accordion.Content>
           <Accordion.Title
             className="file-upload-ordinal-accord-title"
             active={activeAccordionIndexes.includes(0)}
             index={0}
             onClick={this.handleAccordionClick}
            >
             <Icon name='dropdown' />
             Enter Ordinal Features
           </Accordion.Title>
             <Popup
               on="click"
               position="right center"
               header="Ordinal Features Help"
               content={
                 <div className="content">
                  {this.ordFeatHelpText}
                 </div>
               }
               trigger={
                 <Icon
                   className={ordIconClass}
                   inverted
                   size="large"
                   color="orange"
                   name="info circle"
                 />
               }
             />
           <Accordion.Content
              active={activeAccordionIndexes.includes(0)}
            >
              <Dropdown
                style={{
                  backgroundColor: "white",
                  width: "100%"
                }}
                text="Select ordinal features"
                multiple
                search
                options={ordDropdown}

              >
              </Dropdown>
             <textarea
               className="file-upload-ordinal-text-area"
               id="ordinal_features_text_area_input"
               label="Ordinal Features"
               value={ordTextAreaVal}
               placeholder={"{\"ord_feat_1\": [\"SHORT\", \"TALL\"], \"ord_feat_2\": [\"FIRST\", \"SECOND\", \"THIRD\"]}"}
               onChange={this.handleOrdinalFeatures}
             />
           </Accordion.Content>
         </Accordion>
         <Modal

            size="small"
            open={this.state.ordModal}
            style={{ marginTop:"0px" }}
            onClose={this.ordModalClose}
         >
           <Modal.Header>
            Test modal
           </Modal.Header>
           <Modal.Content>
            <h3>minmodal</h3>
            {ordModalContent}
            {JSON.stringify(ordinalFeatures, null, 2)}
           </Modal.Content>
         </Modal>

       </div>
     )
     return accordionContent;
   }

  render() {

    //const { dataset } = this.props;

    let errorMsg = this.state.errorResp;
    let errorContent;
    let dataPrevTable = this.getDataTablePreview();
    let accordionInputs = this.getAccordionInputs();
    //let columnKeys = this.getDataKeys();
    let depColDropdown = this.getDropDown(this.depColDropDownClickHandler);

    //window.console.log('test data keys ', columnKeys);
    // default to hidden until a file is selected, then display input areas
    let formInputClass = "file-upload-form-hide-inputs";
    // if error message present, display for 4.5 seconds
    if (errorMsg) {
      errorContent = ( <p style={{display: 'block'}}> {errorMsg} </p> );
      window.setTimeout(this.errorPopupTimeout, 4555);
    }
    // check if file with filename has been selected, if so then use css to show form
    this.state.selectedFile && this.state.selectedFile.name ?
      formInputClass = "file-upload-form-show-inputs" : null;
    // display file extension Popup
    let openFileTypePop;
    this.state.openFileTypePopup ? openFileTypePop = this.state.openFileTypePopup : openFileTypePop = false;
    // file input
    let fileInputElem = (
      <Input
        style={{width: '65%', backgroundColor: '#2185d0'}}
        type="file"
        label={
          <div style={{color: 'white', paddingRight: '10px', paddingLeft: '5px'}}>
            <p>Please select new dataset
            <br/>
            Supported file types: (<i>csv, tsv</i>)</p>
          </div>
        }
        id="upload_dataset_file_browser_button"
        onChange={this.handleSelectedFile}
      />
    );

    return (
      <div>
        <SceneHeader header="Upload Datasets"/>
        <Form inverted>
          <Segment className="file-upload-segment">
            <Popup
              open={openFileTypePop}
              header="Please check file type"
              content="Unsupported file extension detected"
              trigger={fileInputElem}
            />
            <br/>
            <div
              id="file-upload-form-input-area"
              className={formInputClass}
            >
              <br/>
              <p style={{color: 'white'}}>
                Dependent Column
              </p>
              <Dropdown
                style={{
                  backgroundColor: "white",
                  paddingLeft: "12px"
                }}
                selection
                text="Select dependent column"
                options={depColDropdown}
              >
              </Dropdown>
              <Form.Input
                id="dep_column_form_input"
                style={{
                  width: '65%'
                }}
              >
                <input
                  id="dependent_column_text_field_input"
                  className="file-upload-dependent-text-field"
                  placeholder="Or enter dataset dependent column manually"
                  value={this.state.dependentCol ? this.state.dependentCol : ""}
                  type="text"
                  onChange={this.handleDepColField}
                />
              </Form.Input>
              <Popup
                on="click"
                position="right center"
                header="Dependent Column Help"
                content={
                  <div className="content">
                    <p>
                      {this.depColHelpText}
                    </p>
                  </div>
                }
                trigger={
                  <Icon
                    className="file-upload-dependent-help-icon"
                    inverted
                    size="large"
                    color="orange"
                    name="info circle"
                  />
                }
              />
              <Form.Input
                className="file-upload-accordion-title"
                label="Categorical & Ordinal Features"
              >
                {accordionInputs}
              </Form.Input>
                <Popup
                  header="Error Submitting Dataset"
                  content={errorContent}
                  open={errorMsg ? true : false}
                  id="file_upload_popup_and_button"
                  position='bottom left'
                  flowing
                  trigger={
                    <Button
                      inverted
                      color="blue"
                      compact
                      size="small"
                      icon="upload"
                      content="Upload Dataset"
                      onClick={this.handleUpload}
                    />
                  }
                />
            </div>
          </Segment>
        </Form>
        {dataPrevTable}
        <FileUploadForm />
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  dataset: state.dataset
});

export { FileUpload };
export default connect(mapStateToProps, { fetchDatasets, uploadDataset })(FileUpload);
