import {Box} from 'grid-emotion';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import {omit, isEqual} from 'lodash';
import qs from 'query-string';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import ActionLink from 'app/components/actions/actionLink';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import FileSize from 'app/components/fileSize';
import InlineSvg from 'app/components/inlineSvg';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TimeSince from 'app/components/timeSince';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';

const ProjectDebugSymbols = createReactClass({
  displayName: 'ProjectDebugSymbols',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      debugFiles: [],
      query: '',
      pageLinks: '',
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    const searchHasChanged = !isEqual(
      omit(qs.parse(nextProps.location.search)),
      omit(qs.parse(this.props.location.search))
    );

    if (searchHasChanged) {
      const queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }
  },

  fetchData() {
    const {orgId, projectId} = this.props.params;

    const query = {
      per_page: 20,
      query: this.state.query,
    };

    this.setState({
      loading: true,
    });

    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/`, {
      query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          debugFiles: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  onDelete(id) {
    const {orgId, projectId} = this.props.params;
    this.setState({
      loading: true,
    });
    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/?id=${id}`, {
      method: 'DELETE',
      complete: () => this.fetchData(),
    });
  },

  onSearch(query) {
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;

    let {orgId, projectId} = this.props.params;
    browserHistory.push({
      pathname: `/settings/${orgId}/${projectId}/debug-symbols/`,
      query: targetQueryParams,
    });
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no releases match your filters.')}</p>
      </EmptyStateWarning>
    );
  },

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no debug symbols for this project.')}</p>
      </EmptyStateWarning>
    );
  },

  renderDsyms() {
    let {orgId, projectId} = this.props.params;
    let access = this.getAccess();

    const rows = this.state.debugFiles.map((dsym, key) => {
      const url = `${this.api
        .baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${dsym.id}`;
      return (
        <PanelItem key={key} align="center" px={2} py={1}>
          <Box w={4 / 12}>
            <code className="small">{dsym.debugId || dsym.uuid}</code>
          </Box>
          <Box flex="1">
            {dsym.symbolType === 'proguard' && dsym.objectName === 'proguard-mapping'
              ? '-'
              : dsym.objectName}
            <p className="m-b-0 text-light small">
              {dsym.symbolType === 'proguard' && dsym.cpuName === 'any'
                ? 'proguard'
                : `${dsym.cpuName} (${dsym.symbolType})`}
            </p>
          </Box>
          <Box w={3 / 12} pl={2} className="hidden-xs">
            <p className="m-b-0 text-light small">
              <FileSize bytes={dsym.size} />
            </p>
            <p className="m-b-0 text-light small">
              <span className="icon icon-clock" /> <TimeSince date={dsym.dateCreated} />
            </p>
          </Box>
          <Box flex="1">
            {access.has('project:write') ? (
              <div className="btn-group" style={{float: 'right'}}>
                <ActionLink
                  onAction={() => (window.location = url)}
                  className="btn btn-default btn-sm"
                >
                  <InlineSvg src="icon-download" /> {t('Download')}
                </ActionLink>
                <LinkWithConfirmation
                  className="btn btn-danger btn-sm"
                  title={t('Delete')}
                  message={t(
                    'Are you sure you wish to delete this debug infromation file?'
                  )}
                  onConfirm={() => this.onDelete(dsym.id)}
                >
                  <InlineSvg src="icon-trash" /> {t('Delete')}
                </LinkWithConfirmation>
              </div>
            ) : null}
          </Box>
        </PanelItem>
      );
    });

    return rows;
  },

  renderStreamBody() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.debugFiles.length > 0) body = this.renderDsyms();
    else if (this.state.query && this.state.query !== '')
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

    return body;
  },

  render() {
    return (
      <div>
        <SettingsPageHeader title={t('Debug Information Files')} />
        <TextBlock>
          {t(
            `
          Here you can find all your uploaded debug information files (dSYMs, ProGuard, Breakpad ...).
          This is used to convert addresses and minified function names from crash dumps
          into function names and locations.
        `
          )}
        </TextBlock>

        <div className="ref-project-releases">
          <div className="row release-list-header">
            <div className="col-sm-7" />
            <div className="col-sm-5 release-search">
              <SearchBar
                defaultQuery=""
                placeholder={t('Search for a DIF')}
                query={this.state.query}
                onSearch={this.onSearch}
              />
            </div>
          </div>
          <Panel>
            <PanelHeader>
              <Box w={4 / 12}>{t('Debug ID')}</Box>
              <Box flex="1">{t('Name')}</Box>
              <Box w={3 / 12} pl={2} className="hidden-xs" />
              <Box flex="1" />
            </PanelHeader>
            <PanelBody>{this.renderStreamBody()}</PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.pageLinks} />
        </div>
      </div>
    );
  },
});

export default ProjectDebugSymbols;
