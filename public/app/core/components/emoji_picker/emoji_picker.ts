///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';
import twemoji from 'twemoji';
import emojiDef from './emoji_def';

const DEFAULT_ICON = '1f494'; // Broken heart
const TWEMOJI_BASE = '/public/vendor/npm/twemoji/2/';
const CP_SEPARATOR = emojiDef.CP_SEPARATOR;

let buttonTemplate = `
<span class="gf-form-input width-3">
  <a class="pointer gf-icon-picker-button" ng-click="ctrl.openEmojiPicker($event)">
    <i class="gf-event-icon fa fa-smile-o"></i>
  </a>
</span>
`;

let pickerTemplate = `
<div class="gf-icon-picker">
  <div class="gf-form icon-filter">
    <input type="text"
      ng-model="iconFilter" ng-change="filterIcon()"
      class="gf-form-input max-width-20" placeholder="Find icon by name">
  </div>
  <ul class="nav nav-tabs" id="emojinav">
  </ul>
  <div class="icon-container"></div>
</div>
`;

let codePoints = emojiDef.codePoints;
let emojiDefs = emojiDef.emojiDef;

// Pre-build emoji images elements, grouped by categories.
// Building thousands of elements takes a time, so better to do it one time at application start.
let buildedImagesCategories = buildEmojiByCategories(emojiDefs);

function buildEmojiByCategories(emojiDefs) {
  let builded = {};

  _.each(emojiDef.categories, category => {
    builded[category] = [];
  });

  let emojiElem;
  _.each(emojiDefs, emoji => {
    try {
      emojiElem = buildEmoji(emoji.codepoint);
    } catch (error) {
      console.log(`Error while converting code point ${emoji.codepoint} ${emoji.name}`);
    }
    builded[emoji.category].push(emojiElem);
  });

  return builded;
}

coreModule.directive('gfEmojiPicker', function ($timeout, $compile) {
  function link(scope, elem, attrs) {
    scope.filterIcon = filterIcon;
    scope.categories = emojiDef.categories;
    scope.currentCategory = scope.categories[0];
    scope.prevCategory = scope.currentCategory;
    scope.icons = [];

    addCategories(elem);
    addIcons(elem);

    // Convert pre-built image elements into DOM element and push it into popover
    function addIcons(elem) {
      let container = elem.find(".icon-container");
      _.each(buildedImagesCategories, (categoryElements, category) => {
        let categoryContainer = container.find(`#${category}`);
        _.each(categoryElements, (emojiElem, index) => {
          // When text elem converted into DOM, image is loading. To avoid double compilation and image loading,
          // replace text elem in buildedImagesCategories by real DOM elem after compilation.
          if (_.isString(emojiElem)) {
            emojiElem = $(emojiElem);
            buildedImagesCategories[category][index] = emojiElem;
          }
          categoryContainer.append(emojiElem);
          scope.icons.push(emojiElem);
        });
      });
      container.find('.gf-event-icon').on('click', onEmojiSelect);
    }

    // Insert <div> container for each emoji category
    function addCategories(elem) {
      let container = elem.find(".icon-container");
      let emojinav = elem.find("#emojinav");
      _.each(emojiDef.categories, category => {
        let emoji_tab = emojinav.append($(`
          <li class="gf-tabs-item-emoji">
            <a href="#${category }" data-toggle="tab">${category}</a>
          </li>`
        ));

        let category_container = $(`
          <div id="${category}" ng-show="currentCategory === '${category}'"></div>
        `);
        // Compile new DOM elem to make ng-show worked
        $compile(category_container)(scope);
        container.append(category_container);
      });
      emojinav.find('li:first').addClass('active');

      // switch category
      emojinav.on('show', e => {
        scope.$apply(() => {
          // use href attr (#name => name)
          scope.prevCategory = scope.currentCategory;
          scope.currentCategory = e.target.hash.slice(1);
        });
      });
    }

    function onEmojiSelect(event) {
      let codepoint = $(event.currentTarget).attr('codepoint');
      scope.onSelect(codepoint);
    }

    function filterIcon() {
      let container = elem.find(".icon-container");
      if (scope.iconFilter.length === 0) {
        container.find('#founded-emoji').remove();
        scope.currentCategory = scope.prevCategory;
        return;
      } else {
        let icons = _.filter(scope.icons, icon => {
          let title = icon.attr("title");
          if (title) {
            return title.indexOf(scope.iconFilter) !== -1;
          } else {
            return false;
          }
        });

        if (scope.currentCategory) {
          scope.prevCategory = scope.currentCategory;
        }
        scope.currentCategory = null;

        let findContainerElm = $('<div id="founded-emoji"></div>');
        let findContainer = container.find('#founded-emoji');
        if (findContainer.length === 0) {
          container.append(findContainerElm);
          findContainer = findContainerElm;
        }
        findContainer.empty();
        // clone elements to prevent moving and erasing then
        icons = _.map(icons, icon => icon.clone());
        findContainer.append(icons);
        findContainer.find('.gf-event-icon').on('click', onEmojiSelect);
      }
    }
  }

  return {
    restrict: 'E',
    link: link,
    template: pickerTemplate
  };
});

function attributesCallback(rawText, iconId) {
  let codepoint = twemoji.convert.toCodePoint(rawText);
  return {
    title: emojiDef.emojiMap[codepoint],
    codepoint: codepoint
  };
}

function buildEmoji(codepoint) {
  let utfCode;

  // handle double-sized codepoints like 1f1f7-1f1fa
  if (codepoint.indexOf(CP_SEPARATOR) !== -1) {
    let codepoints = codepoint.split(CP_SEPARATOR);
    utfCode = _.map(codepoints, twemoji.convert.fromCodePoint).join('');
  } else {
    utfCode = twemoji.convert.fromCodePoint(codepoint);
  }

  let emoji = twemoji.parse(utfCode, {
    base: TWEMOJI_BASE,
    folder: 'svg',
    ext: '.svg',
    attributes: attributesCallback,
    className: 'emoji gf-event-icon'
  });

  return emoji;
}

export class IconPickerCtrl {
  iconDrop: any;
  scope: any;
  icon: string;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $timeout, private $compile) {
    this.icon = this.icon || DEFAULT_ICON;
    this.iconDrop = null;
  }

  openEmojiPicker(e) {
    let el = $(e.currentTarget).find('.gf-event-icon');
    let onIconSelect = this.$scope.ctrl.onSelect;

    this.$timeout(() => {
      let options = {
        template: '<gf-emoji-picker></gf-emoji-picker>',
        model: {
          onSelect: onSelect.bind(this)
        },
      };

      this.scope = _.extend(this.$rootScope.$new(true), options.model);
      var contentElement = document.createElement('div');
      contentElement.innerHTML = options.template;
      this.$compile(contentElement)(this.scope);

      let drop = new Drop({
        target: el[0],
        content: contentElement,
        position: 'top center',
        classes: 'drop-popover drop-popover--form',
        openOn: 'hover',
        hoverCloseDelay: 200,
        tetherOptions: {
          constraints: [{ to: 'scrollParent', attachment: "none both" }]
        }
      });

      drop.on('close', this.close.bind(this));

      this.iconDrop = drop;
      this.iconDrop.open();
    });

    function onSelect(codepoint) {
      // Wrap into $apply() to sync changes immediately
      this.$scope.$apply(() => {
        this.$scope.ctrl.icon = codepoint;

        let emoji = buildEmoji(codepoint);
        el.replaceWith(emoji);

        this.iconDrop.close();
      });
    }
  }

  close() {
    this.$timeout(() => {
      this.scope.$destroy();

      if (this.iconDrop.tether) {
        this.iconDrop.destroy();
      }
    });
  }
}

export function iconPicker() {
  return {
    restrict: 'E',
    controller: IconPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    template: buttonTemplate,
    scope: {
      icon: "="
    },
    link: function (scope, elem, attrs)  {
      let codepoint = scope.ctrl.icon || DEFAULT_ICON;
      let emoji = buildEmoji(codepoint);
      elem.find('.gf-event-icon').replaceWith(emoji);
    }
  };
}

coreModule.directive('gfIconPicker', iconPicker);