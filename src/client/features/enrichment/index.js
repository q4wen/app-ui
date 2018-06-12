const React = require('react');
const h = require('react-hyperscript');
//const queryString = require('query-string');
const _ = require('lodash');
//const Loader = require('react-loader');

// const hideTooltips = require('../../common/cy/events/click').hideTooltips;
// const removeStyle= require('../../common/cy/manage-style').removeStyle;
// const make_cytoscape = require('../../common/cy/');
// const interactionsStylesheet= require('../../common/cy/interactions-stylesheet');
const { ServerAPI } = require('../../services/');
const { BaseNetworkView } = require('../../common/components');
//const { getLayoutConfig } = require('../../common/cy/layout');
//const downloadTypes = require('../../common/config').downloadTypes;

const enrichmentConfig={
  //extablish toolbar and declare features to not include
  toolbarButtons: _.differenceBy(BaseNetworkView.config.toolbarButtons,[{'id': 'expandCollapse'}, {'id': 'showInfo'}],'id'),
  menus: BaseNetworkView.config.menus,
  //allow for searching of nodes
  useSearchBar: true
};

//provide user feedback after gene submission
function interpretValidationResult(geneObject, unrecognized, duplicate)
{
  //recognized input
  if(_.isEmpty(duplicate) && unrecognized.length == 0 )
  {
    alert("Thank you for your input. ***Service will continue to analysis");
    // ServerAPI.enrichmentAPI(geneObject, 'analysis');
    // console.log(ServerAPI.enrichmentAPI(geneObject, 'validation'));
    // console.log(ServerAPI.enrichmentAPI(geneObject, 'analysis'));
  }
  //unrecognized token
  else if(unrecognized.length != 0 && _.isEmpty(duplicate) == true)
  {
    let errorMes = "";
    for (let i = 0; i < unrecognized.length; i++)
    {
      errorMes += "\n" + unrecognized[i] + " is not a recognized";
    }
    errorMes += "\nPlease fix your input and submit again";
    alert(errorMes);
  }
  //duplicate tokens (different strings that map to same HGNC number)
  else if(_.isEmpty(duplicate) == false && unrecognized.length == 0)
    {
      let errorMes = "";
      for (let i = 0; i < _.keys(duplicate).length; i++ )
      {
        let propertyName = _.keys(duplicate)[i];
        let duplicateVal = duplicate[propertyName];
        errorMes += "\n" + duplicateVal[0] + " and " + duplicateVal[1] + " are duplicates ";
      }
      errorMes += "\nPlease fix your input and submit again";
      alert(errorMes);
    }
  //unrecognized and duplicates
  else
  {
    let errorMes = "";
    for (let i = 0; i < _.keys(duplicate).length; i++ )
      {
        let propertyName = _.keys(duplicate)[i];
        let duplicateVal = duplicate[propertyName];
        errorMes += "\n" + duplicateVal[0] + " and " + duplicateVal[1] + " are duplicates ";
      }
    for (let i = 0; i < unrecognized.length; i++)
    {
      errorMes += "\n" + unrecognized[i] + " is not recognized";
    }
    errorMes += "\nPlease fix your input and submit again";
    alert(errorMes);
  }
}

class Enrichment extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      componentConfig: enrichmentConfig,
      networkMetadata: {
        name: '',
        datasource: '',
        comments: []
      },
      query: '',
      titleContainer: [],
    };
  }

  //update 'query' with text from input bar
  geneInputChange(e) {
    this.setState( {query: e.target.value});
  }

  //parse and process gene input onClick 'submit'
  geneInputSubmission(query){
    //string to array
    let geneInput = query.split(/\n/g);
    //remove duplicates of same string
    geneInput = _.uniq(geneInput);

    //if(geneInput.length < 5) return alert("Please input 5 or more unique tokens");
    //if(geneInput.length > 200)return alert("Please input 200 or less tokens");

    //put array of genes in object format for validation service
    const geneObject = {genes: _.pull(geneInput,"")};

    //pass object of genes to validation service
    ServerAPI.enrichmentAPI(geneObject, "validation").then(function(result) {
      //object
      let duplicate = result.duplicate;
      //array of objects
      let geneInfo = result.geneInfo;
      //array
      let unrecognized = result.unrecognized;

      //call function to provide user feedback
      interpretValidationResult(geneObject, unrecognized, duplicate);
    });
  }

  render() {
    const state = this.state;
    const baseView = h(BaseNetworkView.component, {
      componentConfig: state.componentConfig,
      //titles at top of toolbar
      networkMetadata: {},
      titleContainer: [
        h('h4', [
          h('span', 'Pathway Enrichment   '),]),
          h('img', {
            src: '/img/humanIcon.png'
            }),
          h('div.gene-input-container', [
            h('textarea.gene-input-box', {
             placeholder: 'Enter one gene per line',
             onChange: e => this.geneInputChange(e),
             onKeyPress: e => {
               this.geneInputChange(e);
             }
            })]),
          h('submit-container', {
            onClick: () => {
              this.geneInputSubmission(this.state.query);
            }},
          [
          h('button.submit', 'Submit'),
          ])
      ]
    });
    return h('div.main', [baseView]);
  }
}
module.exports = Enrichment;

//NOTE: CURRENTLY ONLY RENDERS ON PAGE WHEN base-network-view.js function 'componentDidMount(){}'
//      IS COMMENTED OUT