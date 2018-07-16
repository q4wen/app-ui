const React = require('react');
const h = require('react-hyperscript');
const _ = require('lodash');
const queryString = require('query-string');
const Loader = require('react-loader');

const hideTooltips = require('../../common/cy/events/click').hideTooltips;
const removeStyle= require('../../common/cy/manage-style').removeStyle;
const CytoscapeService = require('../../common/cy/');
const interactionsStylesheet= require('../../common/cy/interactions-stylesheet');
const { ServerAPI } = require('../../services/');
const FilterMenu= require('./filter-menu');
const { BaseNetworkView } = require('../../common/components');
const { getLayoutConfig } = require('../../common/cy/layout');
const downloadTypes = require('../../common/config').downloadTypes;

const filterMenuId='filter-menu';
const toolbarButtons = _.differenceBy(BaseNetworkView.config.toolbarButtons,[{'id': 'expandCollapse'},{'id':'showInfo'}],'id');
const interactionsConfig={
  toolbarButtons: toolbarButtons.concat({
    id: 'filter',
    icon: 'filter_list',
    type: 'activateMenu',
    menuId: filterMenuId,
    description: 'Filter interaction types'
  }),
  menus: BaseNetworkView.config.menus.concat({
    id: filterMenuId,
    width: 25, //%
    func: props => h(FilterMenu, props)
  }),
  useSearchBar: true
};

class Interactions extends React.Component {
  constructor(props) {
    super(props);

    const query = queryString.parse(props.location.search);
    const sources = _.uniq(_.concat([],query.source)); //IDs or URIs

    this.state = {
      cySrv: new CytoscapeService({ style: interactionsStylesheet, showTooltipsOnEdges:true, minZoom:0.01 }),
      componentConfig: {},
      layoutConfig: {},
      networkJSON: {},
      networkMetadata: {
        name : sources+' Interactions',
        datasource : 'Pathway Commons',
        comments: []
      },
      ids: sources,
      loaded: false,
      categories: new Map (),
      //enable all filters by default
      filters:{
        Binding:true,
        Phosphorylation:true,
        Expression:true
      }
    };

    ServerAPI.getInteractionGraph({sources:sources})
      .then(result=>{
        const layoutConfig = getLayoutConfig('interactions');
        const network= result.network;
        this.setState({
          componentConfig : interactionsConfig,
          layoutConfig : layoutConfig,
          networkJSON : network,
          loaded: true
        });
    });

    this.state.cySrv.loadPromise().then(cy => {
      const state = this.state;
      const ids = state.ids;
      if(ids.length === sources.length){
        const cy = state.cy;
        const mainNode = cy.nodes(node=> ids.indexOf(node.data().id) != -1);
        const nodesToKeep = mainNode.merge(mainNode.connectedEdges().connectedNodes());
        cy.remove(cy.nodes().difference(nodesToKeep));
      }
    });

    //when the event 'layoutstop' happens, run this code
    this.state.cy.one('layoutstop',()=>{
      //get variables from state
      const state = this.state;
      const cy = this.state.cy;
      const categories = state.categories;
      const filters=state.filters;
      //for each filter (binding, phosphorylation, expression)
      //value: true/false
      //type: binding/expression etc..
      _.forEach(filters,(value,type)=>{
        //Filter each edge based on which category they belong to
        //get all nodes connected to those edges
        const edges = cy.edges().filter(`.${type}`);
        const nodes = edges.connectedNodes();

        //if the list of edges has a length >0
        //collect data for which edges and nodes are associated with each filter type
        if (edges.length) {
          categories.set(type,{edges:edges,nodes:nodes});
        } else {
        //if there are no edges for this filter, delete the filter
          categories.delete(type);
          delete filters[type];
        }
      });

      //update state with new values
      this.setState({
        categories:categories,
        filters:filters
      });

      //set the layout?
      const initialLayoutOpts = state.layoutConfig.defaultLayout.options;
      const layout = cy.layout(initialLayoutOpts);
      layout.run();
    });
    
  }

  filterUpdate(type) {
    //get variables
    const state = this.state;
    const categories = state.categories;
    const filters = state.filters;
    const cy = state.cySrv.get();
    const edges = categories.get(type).edges;
    const nodes = categories.get(type).nodes;
    //hide all tooltips
    
    hideTooltips(cy);
    //???
    const hovered = cy.filter(ele=>ele.scratch('_hover-style-before'));

    cy.batch(()=>{
      //"you probably do not want to use eles.style() et cetera" - cytoscape documentation
      removeStyle(cy, hovered, '_hover-style-before');
      //remove all nodes & edges matching the passed filter, if set to true
      //if set to false, restore all nodes associated with the filter
      if(filters[type]){
          cy.remove(edges);
          cy.remove(nodes.filter(nodes=>nodes.connectedEdges().empty()));
      }
      else{
        edges.union(nodes).restore();
      }
    });
    
    //toggle the filter
    filters[type]=!filters[type];
    this.setState({
      filters:filters
    });
  }

  /**
   * @description This function generates normalized betweenness centrality values for each node in the network, 
   * and adds the calculated information to each node as a new data field
   */
  generateCentralityValues(){
    //setting up base variables
    const state = this.state;
    const cy = state.cy;
    const bc = cy.$().bc();
    const nodes = cy.nodes();
    if(nodes.length === 0) return;
    

    //loop through the nodes, collected betweenness centrality values
    let centralityVals = [];
    let centralityMap = [];
    nodes.forEach( (ele) => {
      if(ele.data){
        let bcVal = bc.betweenness(ele);
        centralityVals.push(bcVal);
        centralityMap.push([ele,bcVal]);
      }
    });

    //normalize the values and add as field in node data
    const max = Math.max(...centralityVals);
    const min = Math.min(...centralityVals);
    centralityMap.forEach( (ele) => {
      ele[0].data('bcVal',this.normalizeValue(ele[1],max,min));
    });

  }

  /**
   * @description Converts a number to a normalized value in the range [0,1]
   * @param {} value The value to be normalized
   * @param {*} max The maximum number this value can be
   * @param {*} min The minimum number this value can be
   */
  normalizeValue(value,max,min){
    return (value-min)/(max-min);
  }

  render(){
    const state = this.state;
    const loaded = state.loaded;
    this.generateCentralityValues();
    const baseView = !_.isEmpty(state.networkJSON) ? h(BaseNetworkView.component, {
      layoutConfig: state.layoutConfig,
      componentConfig: state.componentConfig,
      cySrv: state.cySrv,
      networkJSON: state.networkJSON,
      networkMetadata: state.networkMetadata,
      //interaction specific
      activeMenu:filterMenuId,
      filterUpdate:(evt,type)=> this.filterUpdate(evt,type),
      filters: state.filters,
      download: {
        types: downloadTypes.filter(ele=>ele.type==='png'||ele.type==='sif'),
        promise: () => Promise.resolve(_.map(state.cySrv.get().edges(),edge=> edge.data().id).sort().join('\n'))
      },
    }):
    h('div.no-network',[h('strong.title','No interactions to display'),h('span','Try a diffrent set of entities')]);

    const loadingView = h(Loader, { loaded: loaded, options: { left: '50%', color: '#16A085' }});

    // create a view shell loading view e.g looks like the view but its not
    const content = loaded ? baseView : loadingView;
    
    return h('div.main', [content]);
  }
}
module.exports = Interactions;